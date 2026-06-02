import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { uploadToR2, uploadFileToR2, getSignedDownloadUrl, getSignedUploadUrl, configureR2Cors, downloadFromR2 } from "./r2";
import { startWorker } from "./worker";
import { renderVariant } from "./video-builder";
import { requireAuth, requireAdmin, hashPassword } from "./auth";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import os from "os";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const uniqueName = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

function runRouteFfmpeg(args: string[], timeoutMs = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegStatic || "ffmpeg", args);
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
      reject(new Error(`FFmpeg timed out after ${timeoutMs / 1000}s. Last output: ${stderr.slice(-500)}`));
    }, timeoutMs);

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-800)}`));
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      if (!killed) reject(err);
    });
  });
}

async function isolateVoiceCloneSample(file: Express.Multer.File): Promise<{ path: string; filename: string; mimeType: string }> {
  const outputPath = path.join(
    os.tmpdir(),
    `voice_clone_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`,
  );
  const audioFilter = [
    "highpass=f=80",
    "lowpass=f=12000",
    "afftdn=nf=-25",
    "dynaudnorm=f=150:g=15",
    "silenceremove=start_periods=1:start_duration=0.15:start_threshold=-45dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-45dB",
  ].join(",");

  await runRouteFfmpeg([
    "-y",
    "-i", file.path,
    "-vn",
    "-map", "0:a:0",
    "-ac", "1",
    "-ar", "44100",
    "-af", audioFilter,
    "-codec:a", "libmp3lame",
    "-b:a", "128k",
    outputPath,
  ]);

  return {
    path: outputPath,
    filename: `${path.parse(file.originalname).name || "voice-sample"}-isolated.mp3`,
    mimeType: "audio/mpeg",
  };
}

function createEditorLlmClient(): OpenAI | null {
  if (process.env.DEEPSEEK_API_KEY) {
    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    });
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  return null;
}

function getGeminiVideoApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
}

function findGeminiVideoUri(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, any>;
  if (typeof record.uri === "string" && /^https?:\/\//.test(record.uri)) return record.uri;
  if (typeof record.downloadUri === "string") return record.downloadUri;
  if (typeof record.videoUri === "string") return record.videoUri;
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findGeminiVideoUri(item);
        if (found) return found;
      }
    } else {
      const found = findGeminiVideoUri(child);
      if (found) return found;
    }
  }
  return null;
}

async function generateGeminiTransitionVideo(prompt: string, seconds: number): Promise<Buffer> {
  const apiKey = getGeminiVideoApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to your environment to enable AI video transitions.");
  }

  const model = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-preview";
  const baseUrl = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const durationSeconds = [4, 6, 8].includes(seconds) ? seconds : 4;
  const startRes = await fetch(`${baseUrl}/models/${model}:predictLongRunning`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        aspectRatio: "9:16",
        resolution: "720p",
        durationSeconds: String(durationSeconds),
        personGeneration: "allow_all",
      },
    }),
  });

  if (!startRes.ok) {
    const errorText = await startRes.text();
    console.error("[gemini-video] start request failed", {
      status: startRes.status,
      model,
      message: errorText.slice(0, 500),
    });
    throw new Error(`Gemini video request failed (${startRes.status}): ${errorText.slice(0, 500)}`);
  }

  const startJson = await startRes.json() as { name?: string };
  if (!startJson.name) throw new Error("Gemini video request did not return an operation name.");

  let operation: any = startJson;
  for (let attempt = 0; attempt < 72; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const statusRes = await fetch(`${baseUrl}/${startJson.name}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      console.error("[gemini-video] status request failed", {
        status: statusRes.status,
        model,
        message: errorText.slice(0, 500),
      });
      throw new Error(`Gemini video status failed (${statusRes.status}): ${errorText.slice(0, 500)}`);
    }
    operation = await statusRes.json();
    if (operation.done) break;
  }

  if (!operation.done) throw new Error("Gemini video generation timed out.");
  if (operation.error) throw new Error(`Gemini video generation failed: ${JSON.stringify(operation.error)}`);

  const videoUri = findGeminiVideoUri(operation.response);
  if (!videoUri) throw new Error("Gemini video generation completed but no video URI was returned.");

  const videoRes = await fetch(videoUri, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!videoRes.ok) {
    const errorText = await videoRes.text();
    throw new Error(`Gemini video download failed (${videoRes.status}): ${errorText.slice(0, 500)}`);
  }

  return Buffer.from(await videoRes.arrayBuffer());
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  configureR2Cors().catch(() => {});

  app.post("/api/upload-url", requireAuth, async (req, res) => {
    try {
      const { type, assetId, filename, contentType } = req.body;
      if (!type || !assetId || !filename || !contentType) {
        return res.status(400).json({ error: "type, assetId, filename, and contentType are required" });
      }
      const ext = filename.split(".").pop()?.toLowerCase() || (type === "photo" ? "jpg" : type === "music" ? "mp3" : "mp4");
      const key = `assets/${assetId}/${type}.${ext}`;
      const url = await getSignedUploadUrl(key, contentType);
      res.json({ url, key });
    } catch (err: any) {
      console.error("Presigned URL error:", err);
      res.status(500).json({ error: err.message || "Failed to generate upload URL" });
    }
  });

  app.post(
    "/api/upload",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      let tempPath: string | undefined;
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "No file provided" });
        }
        tempPath = file.path;

        const fileType = req.body.type;
        if (fileType === "photo" && !file.mimetype.startsWith("image/")) {
          return res.status(400).json({ error: "Photo must be an image file (jpg, png, webp, heic, etc.)" });
        }
        if (fileType === "video" && !file.mimetype.startsWith("video/") && !file.mimetype.startsWith("application/octet-stream")) {
          return res.status(400).json({ error: "Video must be a video file (mp4, mov, avi, webm, etc.)" });
        }

        const ext = file.originalname.split(".").pop()?.toLowerCase() || (fileType === "photo" ? "jpg" : "mp4");
        const assetId = req.body.assetId || uuidv4();
        const key = `assets/${assetId}/${fileType || "file"}.${ext}`;

        await uploadFileToR2(key, file.path, file.mimetype);

        res.json({ key, assetId });
      } catch (err: any) {
        console.error("Upload error:", err);
        res.status(500).json({ error: err.message || "Failed to upload file" });
      } finally {
        if (tempPath) {
          try { fs.unlinkSync(tempPath); } catch {}
        }
      }
    }
  );

  app.post("/api/setup", requireAuth, async (req, res) => {
    try {
      const { name, photoKey, videoKey, videoSource, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance, thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan, musicKey, voiceVolume, musicVolume, autoCaptions, hookHeadline, hookPrompt, hookModel, captionEnabled, captionPrompt, captionModel, seoEnabled, seoPrompt, seoModel } = req.body;

      if (!photoKey) {
        return res.status(400).json({ error: "photoKey is required. Upload photo first." });
      }
      if (videoSource !== "builder" && !videoKey) {
        return res.status(400).json({ error: "videoKey is required for edited video source. Upload video first." });
      }

      const asset = await storage.createAsset({
        name: name || "Untitled Setup",
        photoKey,
        videoKey: videoKey || "",
        videoSource: videoSource || "edited",
        personaPrompt: personaPrompt || "",
        voiceId: voiceId || null,
        voiceName: voiceName || null,
        openaiModel: openaiModel || "gpt-4o",
        elevenlabsModel: elevenlabsModel || "eleven_turbo_v2_5",
        useEnhance: useEnhance !== undefined ? useEnhance : true,
        thresholdDb: typeof thresholdDb === "number" ? thresholdDb : parseFloat(thresholdDb) || -35,
        removeSilencesLongerThan: typeof removeSilencesLongerThan === "number" ? removeSilencesLongerThan : parseFloat(removeSilencesLongerThan) || 0.2,
        ignoreDetectionsShorterThan: typeof ignoreDetectionsShorterThan === "number" ? ignoreDetectionsShorterThan : parseFloat(ignoreDetectionsShorterThan) || 0.75,
        musicKey: musicKey || null,
        voiceVolume: typeof voiceVolume === "number" ? voiceVolume : 1.0,
        musicVolume: typeof musicVolume === "number" ? musicVolume : 0.3,
        autoCaptions: autoCaptions || false,
        hookHeadline: hookHeadline || false,
        hookPrompt: hookPrompt || null,
        hookModel: hookModel || "gpt-4o",
        captionEnabled: captionEnabled || false,
        captionPrompt: captionPrompt || null,
        captionModel: captionModel || "gpt-4o",
        seoEnabled: seoEnabled || false,
        seoPrompt: seoPrompt || null,
        seoModel: seoModel || "gpt-4o",
        userId: req.user!.id,
      });

      res.status(201).json(asset);
    } catch (err: any) {
      console.error("Setup error:", err);
      res.status(500).json({ error: err.message || "Failed to save setup" });
    }
  });

  app.get("/api/assets", requireAuth, async (req, res) => {
    try {
      const assetsList = await storage.getAssets(req.user!.id);
      res.json(assetsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/assets/:id", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAsset(parseInt(req.params.id));
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      res.json(asset);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/assets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await storage.getAsset(id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const { name, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance, thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan, musicKey, voiceVolume, musicVolume, autoCaptions, hookHeadline, hookPrompt, hookModel, captionEnabled, captionPrompt, captionModel, seoEnabled, seoPrompt, seoModel, videoSource, videoKey, photoKey } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (personaPrompt !== undefined) updateData.personaPrompt = personaPrompt;
      if (videoSource !== undefined) updateData.videoSource = videoSource;
      if (videoKey !== undefined) updateData.videoKey = videoKey;
      if (photoKey !== undefined) updateData.photoKey = photoKey;
      if (voiceId !== undefined) updateData.voiceId = voiceId;
      if (voiceName !== undefined) updateData.voiceName = voiceName;
      if (openaiModel !== undefined) updateData.openaiModel = openaiModel;
      if (elevenlabsModel !== undefined) updateData.elevenlabsModel = elevenlabsModel;
      if (useEnhance !== undefined) updateData.useEnhance = useEnhance;
      if (thresholdDb !== undefined) updateData.thresholdDb = typeof thresholdDb === "number" ? thresholdDb : parseFloat(thresholdDb);
      if (removeSilencesLongerThan !== undefined) updateData.removeSilencesLongerThan = typeof removeSilencesLongerThan === "number" ? removeSilencesLongerThan : parseFloat(removeSilencesLongerThan);
      if (ignoreDetectionsShorterThan !== undefined) updateData.ignoreDetectionsShorterThan = typeof ignoreDetectionsShorterThan === "number" ? ignoreDetectionsShorterThan : parseFloat(ignoreDetectionsShorterThan);
      if (musicKey !== undefined) updateData.musicKey = musicKey;
      if (voiceVolume !== undefined) updateData.voiceVolume = typeof voiceVolume === "number" ? voiceVolume : parseFloat(voiceVolume);
      if (musicVolume !== undefined) updateData.musicVolume = typeof musicVolume === "number" ? musicVolume : parseFloat(musicVolume);
      if (autoCaptions !== undefined) updateData.autoCaptions = autoCaptions;
      if (hookHeadline !== undefined) updateData.hookHeadline = hookHeadline;
      if (hookPrompt !== undefined) updateData.hookPrompt = hookPrompt;
      if (hookModel !== undefined) updateData.hookModel = hookModel;
      if (captionEnabled !== undefined) updateData.captionEnabled = captionEnabled;
      if (captionPrompt !== undefined) updateData.captionPrompt = captionPrompt;
      if (captionModel !== undefined) updateData.captionModel = captionModel;
      if (seoEnabled !== undefined) updateData.seoEnabled = seoEnabled;
      if (seoPrompt !== undefined) updateData.seoPrompt = seoPrompt;
      if (seoModel !== undefined) updateData.seoModel = seoModel;

      const updated = await storage.updateAsset(id, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/assets/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await storage.getAsset(id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const duplicate = await storage.createAsset({
        name: `${asset.name} (Copy)`,
        photoKey: asset.photoKey,
        videoKey: asset.videoKey,
        videoSource: asset.videoSource,
        personaPrompt: asset.personaPrompt,
        voiceId: asset.voiceId,
        voiceName: asset.voiceName,
        openaiModel: asset.openaiModel,
        elevenlabsModel: asset.elevenlabsModel,
        useEnhance: asset.useEnhance,
        thresholdDb: asset.thresholdDb,
        removeSilencesLongerThan: asset.removeSilencesLongerThan,
        ignoreDetectionsShorterThan: asset.ignoreDetectionsShorterThan,
        musicKey: asset.musicKey,
        voiceVolume: asset.voiceVolume,
        musicVolume: asset.musicVolume,
        autoCaptions: asset.autoCaptions,
        hookHeadline: asset.hookHeadline,
        hookPrompt: asset.hookPrompt,
        hookModel: asset.hookModel,
        captionEnabled: asset.captionEnabled,
        captionPrompt: asset.captionPrompt,
        captionModel: asset.captionModel,
        seoEnabled: asset.seoEnabled,
        seoPrompt: asset.seoPrompt,
        seoModel: asset.seoModel,
        userId: req.user!.id,
      });

      res.status(201).json(duplicate);
    } catch (err: any) {
      console.error("Duplicate error:", err);
      res.status(500).json({ error: err.message || "Failed to duplicate setup" });
    }
  });

  app.delete("/api/assets/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteAsset(parseInt(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/assets/:id/photo", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAsset(parseInt(req.params.id));
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      const url = await getSignedDownloadUrl(asset.photoKey);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/elevenlabs/voices", requireAuth, async (_req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "ELEVENLABS_API_KEY not configured" });
      }
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: `ElevenLabs API error: ${err}` });
      }
      const data = await response.json() as { voices: Array<{ voice_id: string; name: string; category: string; preview_url?: string }> };
      const voices = data.voices.map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        preview_url: v.preview_url,
      }));
      res.json(voices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/elevenlabs/models", requireAuth, async (_req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "ELEVENLABS_API_KEY not configured" });
      }
      const response = await fetch("https://api.elevenlabs.io/v1/models", {
        headers: { "xi-api-key": apiKey },
      });
      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: `ElevenLabs API error: ${err}` });
      }
      const models = await response.json() as Array<{ model_id: string; name: string; description: string; can_do_text_to_speech: boolean }>;
      const ttsModels = models
        .filter((m) => m.can_do_text_to_speech)
        .map((m) => ({
          model_id: m.model_id,
          name: m.name,
          description: m.description,
        }));
      res.json(ttsModels);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/elevenlabs/voices/clone", requireAuth, upload.array("files", 5), async (req, res) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    const isolatedFiles: Array<{ path: string; filename: string; mimeType: string }> = [];
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "ELEVENLABS_API_KEY not configured" });
      }

      const name = String(req.body.name || "").trim();
      const description = String(req.body.description || "").trim();
      if (!name) {
        return res.status(400).json({ error: "Voice name is required" });
      }
      if (!uploadedFiles.length) {
        return res.status(400).json({ error: "At least one voice sample is required" });
      }

      const formData = new FormData();
      formData.append("name", name);
      if (description) formData.append("description", description);

      for (const file of uploadedFiles) {
        const isolatedFile = await isolateVoiceCloneSample(file);
        isolatedFiles.push(isolatedFile);
        const audio = await fs.promises.readFile(isolatedFile.path);
        formData.append("files", new Blob([audio], { type: isolatedFile.mimeType }), isolatedFile.filename);
      }

      const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: `ElevenLabs API error: ${err}` });
      }

      const data = await response.json();
      res.status(201).json(data);
    } catch (err: any) {
      console.error("ElevenLabs clone voice error:", err);
      res.status(500).json({ error: err.message || "Failed to clone voice" });
    } finally {
      for (const file of uploadedFiles) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      for (const file of isolatedFiles) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
  });

  app.post("/api/editor/generate-script", requireAuth, async (req, res) => {
    try {
      const brief = String(req.body.brief || "").trim();
      const durationSec = Number(req.body.durationSec || 30);
      const model = String(req.body.model || "gpt-4.1-mini");

      if (!brief) {
        return res.status(400).json({ error: "brief is required" });
      }

      const client = createEditorLlmClient();
      if (!client) {
        return res.status(400).json({ error: "OpenAI or DeepSeek API key is not configured" });
      }

      const response = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Buzzly, an AI Content Engine for TikTok and Reels. Create short-form video scripts in a Taglish creator tone. Return valid JSON only with keys: script, captions, hashtags. captions must be an array of 5 to 8 short subtitle lines. hashtags must be a copy-paste-ready string.`,
          },
          {
            role: "user",
            content: `Create a ${durationSec}-second TikTok/Reels script for this brief:\n${brief}\n\nKeep the script punchy, practical, and easy to narrate. Do not include markdown.`,
          },
        ],
        temperature: 0.8,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      let parsed: { script?: string; captions?: string[]; hashtags?: string } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { script: raw, captions: raw.split(/\n+/).filter(Boolean).slice(0, 8), hashtags: "" };
      }

      res.json({
        script: parsed.script || "",
        captions: Array.isArray(parsed.captions) ? parsed.captions : [],
        hashtags: parsed.hashtags || "",
      });
    } catch (err: any) {
      console.error("Editor script generation error:", err);
      res.status(500).json({ error: err.message || "Failed to generate script" });
    }
  });

  app.post("/api/editor/generate-voiceover", requireAuth, async (req, res) => {
    try {
      const text = String(req.body.text || "").trim();
      const voiceId = String(req.body.voiceId || "").trim();
      const modelId = String(req.body.modelId || "eleven_turbo_v2_5");
      const apiKey = process.env.ELEVENLABS_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ error: "ELEVENLABS_API_KEY not configured" });
      }
      if (!text || !voiceId) {
        return res.status(400).json({ error: "text and voiceId are required" });
      }
      if (text.length > 5000) {
        return res.status(400).json({ error: "Voiceover text is too long. Keep it under 5000 characters." });
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: `ElevenLabs API error: ${err}` });
      }

      const audio = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", String(audio.length));
      res.send(audio);
    } catch (err: any) {
      console.error("Editor voiceover error:", err);
      res.status(500).json({ error: err.message || "Failed to generate voiceover" });
    }
  });

  app.post("/api/gemini/video-transition", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        prompt: z.string().min(3).max(1000),
        seconds: z.number().int().refine((value) => [4, 6, 8].includes(value), "seconds must be 4, 6, or 8"),
      });
      const { prompt, seconds } = schema.parse(req.body);
      const videoBuffer = await generateGeminiTransitionVideo(prompt, seconds);
      const key = `generated-transitions/${req.user!.id}/${uuidv4().slice(0, 8)}.mp4`;
      await uploadToR2(key, videoBuffer, "video/mp4");
      const url = await getSignedDownloadUrl(key);
      res.json({
        key,
        url,
        durationSec: seconds,
        filename: path.basename(key),
        model: process.env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-preview",
      });
    } catch (err: any) {
      console.error("Gemini transition error:", err);
      if (err?.issues) {
        return res.status(400).json({ error: err.issues[0]?.message || "Invalid transition request" });
      }
      res.status(500).json({ error: err.message || "Failed to generate Gemini transition" });
    }
  });

  app.post("/api/activate", requireAuth, async (req, res) => {
    try {
      const assetId = parseInt(req.body.assetId);
      if (!assetId || isNaN(assetId)) return res.status(400).json({ error: "Valid assetId is required" });

      const asset = await storage.getAsset(assetId);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      if (!asset.voiceId) {
        return res.status(400).json({ error: "No voice selected for this setup. Please edit the setup first." });
      }

      const job = await storage.createJob(assetId, req.user!.id);
      await storage.appendJobLog(job.id, "Job created, queued for processing");

      res.status(201).json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs", requireAuth, async (req, res) => {
    try {
      const jobsList = await storage.getJobs(req.user!.id);
      res.json(jobsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/jobs", requireAuth, async (req, res) => {
    try {
      const count = await storage.deleteAllJobs(req.user!.id);
      res.json({ deleted: count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      await storage.deleteJob(job.id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/preview", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!job.finalVideoKey) return res.status(400).json({ error: "Final video not yet available" });
      const url = await getSignedDownloadUrl(job.finalVideoKey);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/download", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!job.finalVideoKey) return res.status(400).json({ error: "Final video not yet available" });
      const url = await getSignedDownloadUrl(job.finalVideoKey, `job-${job.id}-final.mp4`);
      res.redirect(url);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/preview-audio-raw", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioRawKey) return res.status(404).json({ error: "Raw audio not available" });
      const url = await getSignedDownloadUrl(job.audioRawKey);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/preview-audio-clean", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioCleanKey) return res.status(404).json({ error: "Clean audio not available" });
      const url = await getSignedDownloadUrl(job.audioCleanKey);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/download-audio-raw", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioRawKey) return res.status(404).json({ error: "Raw audio not available" });
      const url = await getSignedDownloadUrl(job.audioRawKey, `job-${job.id}-voice-raw.mp3`);
      res.redirect(url);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/download-audio-clean", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioCleanKey) return res.status(404).json({ error: "Clean audio not available" });
      const url = await getSignedDownloadUrl(job.audioCleanKey, `job-${job.id}-voice-clean.mp3`);
      res.redirect(url);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/jobs/:id/share", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });

      if (job.shareEnabled) {
        await storage.updateJob(job.id, {
          shareEnabled: false,
          shareToken: null,
          shareRevokedAt: new Date(),
        });
        res.json({ shareEnabled: false });
      } else {
        const shareToken = uuidv4();
        await storage.updateJob(job.id, {
          shareEnabled: true,
          shareToken,
          shareRevokedAt: null,
        });
        res.json({ shareEnabled: true, shareToken });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/s/:token", async (req, res) => {
    try {
      const job = await storage.getJobByShareToken(req.params.token);
      if (!job || !job.shareEnabled || job.shareRevokedAt) {
        return res.status(404).send("Link not found or has been revoked.");
      }
      if (!job.finalVideoKey) {
        return res.status(404).send("Video not yet available.");
      }
      const previewUrl = await getSignedDownloadUrl(job.finalVideoKey);
      const downloadUrl = await getSignedDownloadUrl(job.finalVideoKey, `video-${job.id}.mp4`);
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shared Video</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
    .container { max-width: 600px; width: 100%; text-align: center; }
    video { width: 100%; max-height: 70vh; border-radius: 12px; background: #000; margin-bottom: 20px; }
    .download-btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 600; margin-top: 8px; transition: background 0.2s; }
    .download-btn:hover { background: #1d4ed8; }
    .download-btn:active { background: #1e40af; }
    .subtitle { color: #888; font-size: 14px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <video src="${previewUrl}" controls playsinline preload="metadata"></video>
    <a href="/s/${req.params.token}/download" class="download-btn">Download Video</a>
    <p class="subtitle">Buzzly</p>
  </div>
</body>
</html>`);
    } catch (err: any) {
      res.status(500).send("Error generating download link.");
    }
  });

  app.get("/s/:token/download", async (req, res) => {
    try {
      const job = await storage.getJobByShareToken(req.params.token);
      if (!job || !job.shareEnabled || job.shareRevokedAt) {
        return res.status(404).send("Link not found or has been revoked.");
      }
      if (!job.finalVideoKey) {
        return res.status(404).send("Video not yet available.");
      }
      const url = await getSignedDownloadUrl(job.finalVideoKey, `video-${job.id}.mp4`);
      res.redirect(url);
    } catch (err: any) {
      res.status(500).send("Error generating download link.");
    }
  });

  app.post("/api/convert-music", requireAuth, async (req, res) => {
    try {
      const { r2Key } = req.body;
      if (!r2Key) {
        return res.status(400).json({ error: "r2Key is required" });
      }

      if (!r2Key.startsWith("assets/") || !r2Key.includes("/music.")) {
        return res.status(400).json({ error: "Invalid key: only music files under assets/ can be converted" });
      }

      const videoExts = ["mp4", "mov", "avi", "webm", "mkv", "m4v", "flv", "wmv"];
      const ext = r2Key.split(".").pop()?.toLowerCase() || "";
      if (!videoExts.includes(ext)) {
        return res.status(400).json({ error: "File does not appear to be a video format" });
      }

      const workDir = path.join(os.tmpdir(), `music-convert-${Date.now()}`);
      fs.mkdirSync(workDir, { recursive: true });

      const inputPath = path.join(workDir, `input.${ext}`);
      const outputPath = path.join(workDir, "output.mp3");

      const fileBuffer = await downloadFromR2(r2Key);

      const maxSizeMB = 200;
      if (fileBuffer.length > maxSizeMB * 1024 * 1024) {
        return res.status(400).json({ error: `File too large (${(fileBuffer.length / 1024 / 1024).toFixed(0)} MB). Max is ${maxSizeMB} MB.` });
      }

      fs.writeFileSync(inputPath, fileBuffer);

      await new Promise<void>((resolve, reject) => {
        const { spawn } = require("child_process");
        const ffmpeg = spawn("ffmpeg", [
          "-i", inputPath,
          "-vn",
          "-acodec", "libmp3lame",
          "-ab", "192k",
          "-ar", "44100",
          "-y",
          outputPath,
        ]);
        let stderr = "";
        ffmpeg.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        ffmpeg.on("close", (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        });
        ffmpeg.on("error", reject);
      });

      const audioKey = r2Key.replace(/\.[^.]+$/, ".mp3");
      const audioBuffer = fs.readFileSync(outputPath);
      await uploadToR2(audioKey, audioBuffer, "audio/mpeg");

      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
      try { fs.rmdirSync(workDir); } catch {}

      res.json({ audioKey });
    } catch (err: any) {
      console.error("Music conversion error:", err);
      res.status(500).json({ error: err.message || "Failed to convert video to audio" });
    }
  });

  app.post("/api/upload-source-url", requireAuth, async (req, res) => {
    try {
      const { assetId, filename, contentType } = req.body;
      if (!assetId || !filename || !contentType) {
        return res.status(400).json({ error: "assetId, filename, and contentType are required" });
      }
      const ext = filename.split(".").pop()?.toLowerCase() || "mp4";
      const key = `sources/${assetId}/${uuidv4().slice(0, 8)}.${ext}`;
      const url = await getSignedUploadUrl(key, contentType);
      res.json({ url, key });
    } catch (err: any) {
      console.error("Source video presigned URL error:", err);
      res.status(500).json({ error: err.message || "Failed to generate upload URL" });
    }
  });

  app.post("/api/trim-shot", requireAuth, async (req, res) => {
    try {
      const { sourceR2Key, startSec, endSec, assetId } = req.body;
      if (!sourceR2Key || startSec === undefined || endSec === undefined || !assetId) {
        return res.status(400).json({ error: "sourceR2Key, startSec, endSec, and assetId are required" });
      }

      if (!sourceR2Key.startsWith("sources/")) {
        return res.status(400).json({ error: "Invalid source key" });
      }

      const start = parseFloat(startSec);
      const end = parseFloat(endSec);
      if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
        return res.status(400).json({ error: "Invalid start/end times" });
      }
      if (end - start > 60) {
        return res.status(400).json({ error: "Maximum clip duration is 60 seconds" });
      }

      const workDir = path.join(os.tmpdir(), `trim-${Date.now()}`);
      fs.mkdirSync(workDir, { recursive: true });

      const srcExt = sourceR2Key.split(".").pop()?.toLowerCase() || "mp4";
      const inputPath = path.join(workDir, `source.${srcExt}`);
      const outputPath = path.join(workDir, "trimmed.mp4");

      const fileBuffer = await downloadFromR2(sourceR2Key);

      const maxSourceMB = 500;
      if (fileBuffer.length > maxSourceMB * 1024 * 1024) {
        return res.status(400).json({ error: `Source video too large (${(fileBuffer.length / 1024 / 1024).toFixed(0)} MB). Max is ${maxSourceMB} MB.` });
      }

      fs.writeFileSync(inputPath, fileBuffer);

      await new Promise<void>((resolve, reject) => {
        const { spawn } = require("child_process");
        const ffmpeg = spawn("ffmpeg", [
          "-i", inputPath,
          "-ss", String(start),
          "-to", String(end),
          "-c:v", "libx264",
          "-preset", "fast",
          "-c:a", "aac",
          "-y",
          outputPath,
        ]);
        let stderr = "";
        ffmpeg.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        ffmpeg.on("close", (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg trim failed (code ${code}): ${stderr.slice(-500)}`));
        });
        ffmpeg.on("error", reject);
      });

      const uniqueId = uuidv4().slice(0, 8);
      const trimmedKey = `shots/${assetId}/${uniqueId}.mp4`;
      const trimmedBuffer = fs.readFileSync(outputPath);
      await uploadToR2(trimmedKey, trimmedBuffer, "video/mp4");

      const actualDuration = end - start;

      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
      try { fs.rmdirSync(workDir); } catch {}

      res.json({ key: trimmedKey, durationSec: Math.round(actualDuration * 10) / 10 });
    } catch (err: any) {
      console.error("Trim shot error:", err);
      res.status(500).json({ error: err.message || "Failed to trim video" });
    }
  });

  app.post("/api/upload-shot-url", requireAuth, async (req, res) => {
    try {
      const { assetId, filename, contentType } = req.body;
      if (!assetId || !filename || !contentType) {
        return res.status(400).json({ error: "assetId, filename, and contentType are required" });
      }
      const ext = filename.split(".").pop()?.toLowerCase() || "mp4";
      const uniqueId = uuidv4().slice(0, 8);
      const key = `shots/${assetId}/${uniqueId}.${ext}`;
      const url = await getSignedUploadUrl(key, contentType);
      res.json({ url, key });
    } catch (err: any) {
      console.error("Shot presigned URL error:", err);
      res.status(500).json({ error: err.message || "Failed to generate upload URL" });
    }
  });

  app.post("/api/assets/:id/shots", requireAuth, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const asset = await storage.getAsset(assetId);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const { category, shotType, durationSec, r2Key, orientation, filename } = req.body;
      if (!category || !durationSec || !r2Key) {
        return res.status(400).json({ error: "category, durationSec, and r2Key are required" });
      }

      const shot = await storage.createShot({
        assetId,
        category,
        shotType: shotType || null,
        durationSec: parseFloat(durationSec),
        r2Key,
        orientation: orientation || "portrait",
        filename: filename || null,
      });

      res.status(201).json(shot);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/assets/:id/shots", requireAuth, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const shotsList = await storage.getShots(assetId);
      res.json(shotsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/shots/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteShot(parseInt(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/assets/:id/generate-variants", requireAuth, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const asset = await storage.getAsset(assetId);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const { templateDuration, numVariants } = req.body;
      const duration = parseInt(templateDuration) || 45;
      const count = Math.min(parseInt(numVariants) || 1, 20);

      if (duration !== 45 && duration !== 60) {
        return res.status(400).json({ error: "templateDuration must be 45 or 60" });
      }

      const allShots = await storage.getShots(assetId);
      if (allShots.length === 0) {
        return res.status(400).json({ error: "No shots uploaded. Upload shot clips first." });
      }

      const recentClipIds = await storage.getRecentVariantClipIds(assetId, 10);

      const shotsByCategory: Record<string, typeof allShots> = {};
      for (const s of allShots) {
        if (!shotsByCategory[s.category]) shotsByCategory[s.category] = [];
        shotsByCategory[s.category].push(s);
      }

      const hookShots = shotsByCategory["HOOK"] || [];
      const problemShots = shotsByCategory["PROBLEM"] || [];
      const solutionShots = shotsByCategory["SOLUTION"] || [];
      const highlightShots = shotsByCategory["HIGHLIGHT"] || [];
      const bodyShots = shotsByCategory["BODY"] || [];
      const ctaShots = shotsByCategory["CTA"] || [];

      if (hookShots.length === 0) return res.status(400).json({ error: "At least 1 HOOK shot is required" });
      if (bodyShots.length < 4) return res.status(400).json({ error: "At least 4 BODY shots with distinct shotTypes are required" });

      const bodyTypesArr = bodyShots.map(s => s.shotType).filter((t): t is string => !!t);
      const bodyTypesAvailable = new Set(bodyTypesArr);
      if (bodyTypesAvailable.size < 4) {
        return res.status(400).json({ error: `Need >= 4 distinct BODY shotTypes, found ${bodyTypesAvailable.size}: ${Array.from(bodyTypesAvailable).join(", ")}` });
      }

      const bodyCount = duration === 45 ? 6 : 8;
      const needCta = duration === 60 || ctaShots.length > 0;

      const createdVariants = [];

      for (let v = 0; v < count; v++) {
        const usedIds = new Set<number>();
        const clipIds: number[] = [];

        const pick = (pool: typeof allShots, fallback?: typeof allShots): number | null => {
          const preferred = pool.filter(s => !usedIds.has(s.id) && !recentClipIds.includes(s.id));
          const available = preferred.length > 0 ? preferred : pool.filter(s => !usedIds.has(s.id));
          if (available.length === 0 && fallback) {
            const fb = fallback.filter(s => !usedIds.has(s.id));
            if (fb.length > 0) {
              const chosen = fb[Math.floor(Math.random() * fb.length)];
              usedIds.add(chosen.id);
              return chosen.id;
            }
            return null;
          }
          if (available.length === 0) return null;
          const chosen = available[Math.floor(Math.random() * available.length)];
          usedIds.add(chosen.id);
          return chosen.id;
        };

        const hookId = pick(hookShots);
        if (hookId) clipIds.push(hookId);

        const problemId = pick(problemShots, hookShots);
        if (problemId) clipIds.push(problemId);

        const solutionId = pick(solutionShots, highlightShots);
        if (solutionId) clipIds.push(solutionId);

        const highlightId = pick(highlightShots, bodyShots);
        if (highlightId) clipIds.push(highlightId);

        const usedBodyTypes = new Set<string>();
        const bodyClipIds: number[] = [];
        const effectiveBodyCount = (needCta && duration === 45 && ctaShots.length > 0) ? bodyCount - 1 : bodyCount;

        for (let b = 0; b < effectiveBodyCount; b++) {
          let pool: typeof allShots;
          if (usedBodyTypes.size < 4) {
            pool = bodyShots.filter(s =>
              !usedIds.has(s.id) && s.shotType && !usedBodyTypes.has(s.shotType)
            );
            if (pool.length === 0) {
              pool = bodyShots.filter(s => !usedIds.has(s.id));
            }
          } else {
            pool = bodyShots.filter(s => !usedIds.has(s.id));
          }

          const preferred = pool.filter(s => !recentClipIds.includes(s.id));
          const candidates = preferred.length > 0 ? preferred : pool;
          if (candidates.length === 0) break;

          const chosen = candidates[Math.floor(Math.random() * candidates.length)];
          usedIds.add(chosen.id);
          if (chosen.shotType) usedBodyTypes.add(chosen.shotType);
          bodyClipIds.push(chosen.id);
        }
        clipIds.push(...bodyClipIds);

        if (needCta) {
          const ctaId = pick(ctaShots, bodyShots);
          if (ctaId) clipIds.push(ctaId);
        }

        const variant = await storage.createVariant({
          assetId,
          templateDuration: duration,
          clipIds,
          status: "pending",
        });
        createdVariants.push(variant);
      }

      res.status(201).json(createdVariants);
    } catch (err: any) {
      console.error("Generate variants error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/assets/:id/variants", requireAuth, async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const variantsList = await storage.getVariants(assetId);
      res.json(variantsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/variants/:id/render", requireAuth, async (req, res) => {
    try {
      const variantId = parseInt(req.params.id);
      const variant = await storage.getVariant(variantId);
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      if (variant.status === "rendering") {
        return res.status(409).json({ error: "Already rendering" });
      }

      await storage.updateVariant(variantId, { status: "rendering" });
      res.json({ status: "rendering", variantId });

      renderVariant(variantId).catch(async (err: any) => {
        console.error(`Variant ${variantId} render failed:`, err);
        await storage.updateVariant(variantId, { status: "failed" });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/variants/:id/download", requireAuth, async (req, res) => {
    try {
      const variant = await storage.getVariant(parseInt(req.params.id));
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      if (!variant.r2Key) return res.status(400).json({ error: "Video not yet rendered" });
      const url = await getSignedDownloadUrl(variant.r2Key, `variant-${variant.id}.mp4`);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/variants/:id/preview", requireAuth, async (req, res) => {
    try {
      const variant = await storage.getVariant(parseInt(req.params.id));
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      if (!variant.r2Key) return res.status(400).json({ error: "Video not yet rendered" });
      const url = await getSignedDownloadUrl(variant.r2Key);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/variants/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteVariant(parseInt(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/variants/:id/send-to-pipeline", requireAuth, async (req, res) => {
    try {
      const variantId = parseInt(req.params.id);
      const variant = await storage.getVariant(variantId);
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      if (!variant.r2Key) return res.status(400).json({ error: "Variant not yet rendered" });

      const asset = await storage.getAsset(variant.assetId);
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      if (!asset.voiceId) return res.status(400).json({ error: "No voice selected for this setup. Edit the setup first." });

      await storage.updateAsset(variant.assetId, { videoKey: variant.r2Key });

      const job = await storage.createJob(variant.assetId, req.user!.id);
      await storage.appendJobLog(job.id, `Job created from Video Builder variant #${variantId}`);

      res.status(201).json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const usersList = await storage.getUsers();
      res.json(usersList.map((u) => ({ id: u.id, username: u.username, role: u.role, status: u.status, createdAt: u.createdAt })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username and password required" });

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ error: "Username already taken" });

      const hashed = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashed,
        role: role || "user",
        status: "approved",
      });
      res.status(201).json({ id: user.id, username: user.username, role: user.role, status: user.status, createdAt: user.createdAt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { username, status, role, password } = req.body;
      const updateData: any = {};
      if (username !== undefined) updateData.username = username;
      if (status !== undefined) updateData.status = status;
      if (role !== undefined) updateData.role = role;
      if (password) {
        updateData.password = await hashPassword(password);
      }
      const updated = await storage.updateUser(id, updateData);
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ id: updated.id, username: updated.username, role: updated.role, status: updated.status, createdAt: updated.createdAt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id === req.user!.id) return res.status(400).json({ error: "Cannot delete your own account" });
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/script-prompts", requireAuth, async (req, res) => {
    try {
      const prompts = await storage.getScriptPrompts(req.user!.id);
      res.json(prompts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/script-prompts", requireAuth, async (req, res) => {
    try {
      const { name, promptText } = req.body;
      if (!name?.trim() || !promptText?.trim()) return res.status(400).json({ error: "Name and prompt text are required" });
      const prompt = await storage.createScriptPrompt({ userId: req.user!.id, name: name.trim(), promptText: promptText.trim() });
      res.json(prompt);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/script-prompts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, promptText } = req.body;
      const updates: Record<string, string> = {};
      if (name?.trim()) updates.name = name.trim();
      if (promptText?.trim()) updates.promptText = promptText.trim();
      const prompt = await storage.updateScriptPrompt(id, req.user!.id, updates);
      if (!prompt) return res.status(404).json({ error: "Prompt not found" });
      res.json(prompt);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/script-prompts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteScriptPrompt(parseInt(req.params.id), req.user!.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const excludedWords = await storage.getExcludedWords(req.user!.id);
      res.json({ excludedWords });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/settings", requireAuth, async (req, res) => {
    try {
      const { excludedWords } = req.body;
      await storage.updateExcludedWords(req.user!.id, excludedWords ?? "");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  startWorker();

  return httpServer;
}

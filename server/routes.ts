import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { uploadFileToR2, getSignedDownloadUrl, getSignedUploadUrl, configureR2Cors, downloadFromR2 } from "./r2";
import { startWorker } from "./worker";
import { renderVariant } from "./video-builder";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import os from "os";
import path from "path";
import fs from "fs";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  configureR2Cors().catch(() => {});

  app.post("/api/upload-url", async (req, res) => {
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

  app.post("/api/setup", async (req, res) => {
    try {
      const { name, photoKey, videoKey, videoSource, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance, thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan, musicKey, voiceVolume, musicVolume, autoCaptions, hookHeadline, hookPrompt } = req.body;

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
        elevenlabsModel: elevenlabsModel || "eleven_multilingual_v2",
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
      });

      res.status(201).json(asset);
    } catch (err: any) {
      console.error("Setup error:", err);
      res.status(500).json({ error: err.message || "Failed to save setup" });
    }
  });

  app.get("/api/assets", async (_req, res) => {
    try {
      const assetsList = await storage.getAssets();
      res.json(assetsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/assets/:id", async (req, res) => {
    try {
      const asset = await storage.getAsset(parseInt(req.params.id));
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      res.json(asset);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/assets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await storage.getAsset(id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const { name, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, useEnhance, thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan, musicKey, voiceVolume, musicVolume, autoCaptions, hookHeadline, hookPrompt, videoSource, videoKey } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (personaPrompt !== undefined) updateData.personaPrompt = personaPrompt;
      if (videoSource !== undefined) updateData.videoSource = videoSource;
      if (videoKey !== undefined) updateData.videoKey = videoKey;
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

      const updated = await storage.updateAsset(id, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/assets/:id", async (req, res) => {
    try {
      await storage.deleteAsset(parseInt(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/assets/:id/photo", async (req, res) => {
    try {
      const asset = await storage.getAsset(parseInt(req.params.id));
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      const url = await getSignedDownloadUrl(asset.photoKey);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/elevenlabs/voices", async (_req, res) => {
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
      const data = await response.json() as { voices: Array<{ voice_id: string; name: string; category: string }> };
      const voices = data.voices.map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
      }));
      res.json(voices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/elevenlabs/models", async (_req, res) => {
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

  app.post("/api/activate", async (req, res) => {
    try {
      const assetId = parseInt(req.body.assetId);
      if (!assetId || isNaN(assetId)) return res.status(400).json({ error: "Valid assetId is required" });

      const asset = await storage.getAsset(assetId);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      if (!asset.voiceId) {
        return res.status(400).json({ error: "No voice selected for this setup. Please edit the setup first." });
      }

      const job = await storage.createJob(assetId);
      await storage.appendJobLog(job.id, "Job created, queued for processing");

      res.status(201).json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs", async (_req, res) => {
    try {
      const jobsList = await storage.getJobs();
      res.json(jobsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      await storage.deleteJob(job.id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/preview", async (req, res) => {
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

  app.get("/api/jobs/:id/download", async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!job.finalVideoKey) return res.status(400).json({ error: "Final video not yet available" });
      const url = await getSignedDownloadUrl(job.finalVideoKey, `job-${job.id}-final.mp4`);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/download-audio-raw", async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioRawKey) return res.status(404).json({ error: "Raw audio not available" });
      const url = await getSignedDownloadUrl(job.audioRawKey, `job-${job.id}-voice-raw.mp3`);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/download-audio-clean", async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioCleanKey) return res.status(404).json({ error: "Clean audio not available" });
      const url = await getSignedDownloadUrl(job.audioCleanKey, `job-${job.id}-voice-clean.mp3`);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/jobs/:id/share", async (req, res) => {
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
      const url = await getSignedDownloadUrl(job.finalVideoKey);
      res.redirect(url);
    } catch (err: any) {
      res.status(500).send("Error generating download link.");
    }
  });

  app.post("/api/upload-shot-url", async (req, res) => {
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

  app.post("/api/assets/:id/shots", async (req, res) => {
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

  app.get("/api/assets/:id/shots", async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const shotsList = await storage.getShots(assetId);
      res.json(shotsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/shots/:id", async (req, res) => {
    try {
      await storage.deleteShot(parseInt(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/assets/:id/generate-variants", async (req, res) => {
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

  app.get("/api/assets/:id/variants", async (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const variantsList = await storage.getVariants(assetId);
      res.json(variantsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/variants/:id/render", async (req, res) => {
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

  app.get("/api/variants/:id/download", async (req, res) => {
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

  app.get("/api/variants/:id/preview", async (req, res) => {
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

  app.delete("/api/variants/:id", async (req, res) => {
    try {
      await storage.deleteVariant(parseInt(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/variants/:id/send-to-pipeline", async (req, res) => {
    try {
      const variantId = parseInt(req.params.id);
      const variant = await storage.getVariant(variantId);
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      if (!variant.r2Key) return res.status(400).json({ error: "Variant not yet rendered" });

      const asset = await storage.getAsset(variant.assetId);
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      if (!asset.voiceId) return res.status(400).json({ error: "No voice selected for this setup. Edit the setup first." });

      await storage.updateAsset(variant.assetId, { videoKey: variant.r2Key });

      const job = await storage.createJob(variant.assetId);
      await storage.appendJobLog(job.id, `Job created from Video Builder variant #${variantId}`);

      res.status(201).json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  startWorker();

  return httpServer;
}

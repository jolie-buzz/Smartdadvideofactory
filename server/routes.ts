import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { uploadFileToR2, getSignedDownloadUrl } from "./r2";
import { startWorker } from "./worker";
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
      const { name, photoKey, videoKey, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan } = req.body;

      if (!photoKey || !videoKey) {
        return res.status(400).json({ error: "Both photoKey and videoKey are required. Upload files first." });
      }

      const asset = await storage.createAsset({
        name: name || "Untitled Setup",
        photoKey,
        videoKey,
        personaPrompt: personaPrompt || "",
        voiceId: voiceId || null,
        voiceName: voiceName || null,
        openaiModel: openaiModel || "gpt-4o",
        elevenlabsModel: elevenlabsModel || "eleven_multilingual_v2",
        thresholdDb: typeof thresholdDb === "number" ? thresholdDb : parseFloat(thresholdDb) || -35,
        removeSilencesLongerThan: typeof removeSilencesLongerThan === "number" ? removeSilencesLongerThan : parseFloat(removeSilencesLongerThan) || 0.2,
        ignoreDetectionsShorterThan: typeof ignoreDetectionsShorterThan === "number" ? ignoreDetectionsShorterThan : parseFloat(ignoreDetectionsShorterThan) || 0.75,
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

      const { name, personaPrompt, voiceId, voiceName, openaiModel, elevenlabsModel, thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (personaPrompt !== undefined) updateData.personaPrompt = personaPrompt;
      if (voiceId !== undefined) updateData.voiceId = voiceId;
      if (voiceName !== undefined) updateData.voiceName = voiceName;
      if (openaiModel !== undefined) updateData.openaiModel = openaiModel;
      if (elevenlabsModel !== undefined) updateData.elevenlabsModel = elevenlabsModel;
      if (thresholdDb !== undefined) updateData.thresholdDb = typeof thresholdDb === "number" ? thresholdDb : parseFloat(thresholdDb);
      if (removeSilencesLongerThan !== undefined) updateData.removeSilencesLongerThan = typeof removeSilencesLongerThan === "number" ? removeSilencesLongerThan : parseFloat(removeSilencesLongerThan);
      if (ignoreDetectionsShorterThan !== undefined) updateData.ignoreDetectionsShorterThan = typeof ignoreDetectionsShorterThan === "number" ? ignoreDetectionsShorterThan : parseFloat(ignoreDetectionsShorterThan);

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

  app.get("/api/jobs/:id/download", async (req, res) => {
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

  app.get("/api/jobs/:id/download-audio-raw", async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioRawKey) return res.status(404).json({ error: "Raw audio not available" });
      const url = await getSignedDownloadUrl(job.audioRawKey);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs/:id/download-audio-clean", async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job || !job.audioCleanKey) return res.status(404).json({ error: "Clean audio not available" });
      const url = await getSignedDownloadUrl(job.audioCleanKey);
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

  startWorker();

  return httpServer;
}

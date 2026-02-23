import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { uploadToR2, getSignedDownloadUrl } from "./r2";
import { startWorker } from "./worker";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(
    "/api/setup",
    upload.fields([
      { name: "photo", maxCount: 1 },
      { name: "video", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const photo = files?.photo?.[0];
        const video = files?.video?.[0];

        if (!photo || !video) {
          return res.status(400).json({ error: "Both photo and video files are required" });
        }

        if (!photo.mimetype.startsWith("image/")) {
          return res.status(400).json({ error: "Photo must be an image file (jpg, png, webp, heic, etc.)" });
        }
        if (!video.mimetype.startsWith("video/") && !video.mimetype.startsWith("application/octet-stream")) {
          return res.status(400).json({ error: "Video must be a video file (mp4, mov, avi, webm, etc.)" });
        }

        const photoExt = photo.originalname.split(".").pop()?.toLowerCase() || "jpg";
        const videoExt = video.originalname.split(".").pop()?.toLowerCase() || "mp4";

        const assetId = uuidv4();
        const photoKey = `assets/${assetId}/photo.${photoExt}`;
        const videoKey = `assets/${assetId}/video.${videoExt}`;

        await uploadToR2(photoKey, photo.buffer, photo.mimetype);
        await uploadToR2(videoKey, video.buffer, video.mimetype);

        const name = req.body.name || "Untitled Setup";
        const personaPrompt = req.body.personaPrompt || "";
        const voiceId = req.body.voiceId || null;
        const voiceName = req.body.voiceName || null;
        const thresholdDb = parseFloat(req.body.thresholdDb) || -35;
        const removeSilencesLongerThan = parseFloat(req.body.removeSilencesLongerThan) || 0.2;
        const ignoreDetectionsShorterThan = parseFloat(req.body.ignoreDetectionsShorterThan) || 0.75;

        const asset = await storage.createAsset({
          name,
          photoKey,
          videoKey,
          personaPrompt,
          voiceId,
          voiceName,
          thresholdDb,
          removeSilencesLongerThan,
          ignoreDetectionsShorterThan,
        });

        res.status(201).json(asset);
      } catch (err: any) {
        console.error("Setup error:", err);
        res.status(500).json({ error: err.message || "Failed to save setup" });
      }
    }
  );

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

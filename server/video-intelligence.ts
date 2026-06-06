import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";
import { createHash } from "crypto";
import { spawn } from "child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { storage } from "./storage";
import { downloadFromR2 } from "./r2";
import type { Asset, VideoAnalysis } from "@shared/schema";

export const VIDEO_ANALYSIS_VERSION = "video-intelligence-v1";
export const VIDEO_ANALYSIS_MODEL = process.env.VIDEO_ANALYSIS_MODEL || "gpt-4o";

type AnalysisTarget = {
  r2Key: string;
  source: "asset-video" | "builder-shot";
};

function createVisionClient(): OpenAI | null {
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

function runFfmpeg(args: string[], timeoutMs = 180_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegStatic || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
      reject(new Error(`FFmpeg keyframe extraction timed out. Last output: ${stderr.slice(-500)}`));
    }, timeoutMs);

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg keyframe extraction failed (${code}): ${stderr.slice(-800)}`));
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      if (!killed) reject(err);
    });
  });
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Video analysis model returned non-JSON output");
    return JSON.parse(match[0]);
  }
}

async function extractKeyframes(videoBuffer: Buffer): Promise<string[]> {
  const workDir = await mkdtemp(join(tmpdir(), "video-analysis-"));
  try {
    const inputPath = join(workDir, "input.mp4");
    await writeFile(inputPath, videoBuffer);

    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vf", "fps=1/2,scale=640:-1",
      "-frames:v", "8",
      "-q:v", "3",
      join(workDir, "frame_%02d.jpg"),
    ]);

    const files = (await readdir(workDir))
      .filter((file) => /^frame_\d+\.jpg$/.test(file))
      .sort();

    const dataUrls: string[] = [];
    for (const file of files) {
      const frame = await readFile(join(workDir, file));
      dataUrls.push(`data:image/jpeg;base64,${frame.toString("base64")}`);
    }
    return dataUrls;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function analyzeKeyframes(keyframeDataUrls: string[], model: string): Promise<Record<string, unknown>> {
  const client = createVisionClient();
  if (!client) {
    throw new Error("Missing OpenAI credentials for video analysis. Set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.");
  }
  if (keyframeDataUrls.length === 0) {
    throw new Error("No keyframes were extracted from this video");
  }

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    max_completion_tokens: 2400,
    messages: [
      {
        role: "system",
        content: [
          "You are Buzzly/Brandy's reusable Video Intelligence Layer.",
          "Analyze product/social video keyframes once, then return reusable production intelligence as strict JSON.",
          "Return concise but useful arrays. Do not include markdown.",
          "Required JSON keys: overall_summary, product_or_main_subject, scenes, visible_actions, detected_text_ocr, emotional_tone, pacing, important_moments, suggested_hooks, suggested_sound_effects, suggested_transitions, suggested_captions_overlay_text, suggested_cut_points, possible_product_benefits_shown_visually.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze these sampled video keyframes for reusable script, captions, hook, sound, transition, auto-cut, and timeline-label decisions.",
          },
          ...keyframeDataUrls.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        ] as any,
      },
    ],
  });

  return parseJsonObject(response.choices[0]?.message?.content?.trim() || "{}");
}

export async function getAssetAnalysisTarget(asset: Asset): Promise<AnalysisTarget | null> {
  if (asset.videoKey) {
    return { r2Key: asset.videoKey, source: "asset-video" };
  }

  const shots = await storage.getShots(asset.id);
  const firstShot = [...shots].sort((a, b) => a.id - b.id)[0];
  if (!firstShot?.r2Key) return null;
  return { r2Key: firstShot.r2Key, source: "builder-shot" };
}

export async function ensureVideoAnalysisForAsset(
  asset: Asset,
  options: { force?: boolean; model?: string; analysisVersion?: string } = {},
): Promise<{ analysis: VideoAnalysis; reused: boolean; videoHash: string; source: AnalysisTarget["source"] }> {
  const model = options.model || VIDEO_ANALYSIS_MODEL;
  const analysisVersion = options.analysisVersion || VIDEO_ANALYSIS_VERSION;
  const target = await getAssetAnalysisTarget(asset);
  if (!target) {
    throw new Error("No video found to analyze. Upload or save a Studio video first.");
  }

  const videoBuffer = await downloadFromR2(target.r2Key);
  const videoHash = createHash("sha256").update(videoBuffer).digest("hex");

  if (!options.force) {
    const cached = await storage.getVideoAnalysisByHash(videoHash, analysisVersion, model);
    if (cached) {
      if (cached.videoAssetId === asset.id) {
        return { analysis: cached, reused: true, videoHash, source: target.source };
      }
      const cloned = await storage.createVideoAnalysis({
        videoAssetId: asset.id,
        videoHash,
        analysisJson: cached.analysisJson,
        modelUsed: model,
        analysisVersion,
      });
      return { analysis: cloned, reused: true, videoHash, source: target.source };
    }
  }

  const keyframes = await extractKeyframes(videoBuffer);
  const analysisJson = await analyzeKeyframes(keyframes, model);
  const analysis = await storage.createVideoAnalysis({
    videoAssetId: asset.id,
    videoHash,
    analysisJson,
    modelUsed: model,
    analysisVersion,
  });

  return { analysis, reused: false, videoHash, source: target.source };
}

export function summarizeVideoAnalysisForPrompt(analysis?: VideoAnalysis | null): string {
  if (!analysis?.analysisJson) return "";
  return JSON.stringify(analysis.analysisJson).slice(0, 6000);
}

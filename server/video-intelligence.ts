import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";
import { spawn } from "child_process";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { storage } from "./storage";
import { downloadFileFromR2, hashFileSha256 } from "./r2";
import type { Asset, VideoAnalysis } from "@shared/schema";

export const VIDEO_ANALYSIS_VERSION = "video-intelligence-v2";
export const VIDEO_ANALYSIS_MODEL = process.env.VIDEO_ANALYSIS_MODEL || "gpt-4o";
const KEYFRAME_INTERVAL_SEC = 2;
const ANALYSIS_CHUNK_FRAME_COUNT = Math.max(4, Number(process.env.VIDEO_ANALYSIS_CHUNK_FRAMES || 12));

type AnalysisTarget = {
  r2Key: string;
  source: "asset-video" | "builder-shot";
};

type KeyframeSample = {
  timeSec: number;
  path: string;
};

type VisionFrame = {
  timeSec: number;
  dataUrl: string;
};

type TimelineContextScene = {
  id: string;
  name: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number;
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

async function extractKeyframes(inputPath: string, workDir: string): Promise<KeyframeSample[]> {
  await runFfmpeg([
    "-y",
    "-threads", "1",
    "-i", inputPath,
    "-vf", `fps=1/${KEYFRAME_INTERVAL_SEC},scale=640:-1`,
    "-q:v", "3",
    join(workDir, "frame_%05d.jpg"),
  ], 600_000);

  const files = (await readdir(workDir))
    .filter((file) => /^frame_\d+\.jpg$/.test(file))
    .sort();

  return files.map((file, index) => ({
    timeSec: index * KEYFRAME_INTERVAL_SEC,
    path: join(workDir, file),
  }));
}

function chunkKeyframes(samples: KeyframeSample[]): KeyframeSample[][] {
  const chunks: KeyframeSample[][] = [];
  for (let index = 0; index < samples.length; index += ANALYSIS_CHUNK_FRAME_COUNT) {
    chunks.push(samples.slice(index, index + ANALYSIS_CHUNK_FRAME_COUNT));
  }
  return chunks;
}

async function loadVisionFrames(keyframes: KeyframeSample[]): Promise<VisionFrame[]> {
  return Promise.all(keyframes.map(async (frame) => {
    const image = await readFile(frame.path);
    return {
      timeSec: frame.timeSec,
      dataUrl: `data:image/jpeg;base64,${image.toString("base64")}`,
    };
  }));
}

function buildTimelineContext(timelineJson?: Record<string, any> | null): TimelineContextScene[] {
  const tracks = Array.isArray(timelineJson?.tracks) ? timelineJson.tracks : [];
  return tracks
    .flatMap((track: any) => Array.isArray(track.items) ? track.items : [])
    .filter((item: any) => item?.type === "video")
    .sort((a: any, b: any) => Number(a.startTime || 0) - Number(b.startTime || 0))
    .map((item: any) => {
      const startSec = Number(item.startTime || 0);
      const durationSec = Number(item.duration || 0);
      return {
        id: String(item.id || ""),
        name: String(item.name || "Video clip"),
        startSec,
        endSec: Number((startSec + durationSec).toFixed(2)),
        durationSec,
        trimStartSec: Number(item.trimStart || 0),
        trimEndSec: Number(item.trimEnd || durationSec),
      };
    });
}

async function analyzeKeyframes(keyframes: KeyframeSample[], model: string, timelineScenes: TimelineContextScene[], chunkLabel?: string): Promise<Record<string, unknown>> {
  const client = createVisionClient();
  if (!client) {
    throw new Error("Missing OpenAI credentials for video analysis. Set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.");
  }
  if (keyframes.length === 0) {
    throw new Error("No keyframes were extracted from this video");
  }
  const visionFrames = await loadVisionFrames(keyframes);

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
          "The keyframes are sampled every 2 seconds across the full uploaded video. Analyze the whole visual sequence, not only the first few frames.",
          "Use visual evidence only for now. Do not invent audio, dialogue, or unseen claims.",
          "Return concise but useful arrays. Do not include markdown.",
          "The user needs time-aware analysis. Group adjacent samples into practical beats, but do not force rigid timing when the visuals are unclear.",
          "Every scene, important moment, hook, weak spot, shot category, transition, caption, cut point, and voiceover beat should include start_sec/end_sec or at_sec whenever possible.",
          "Required JSON keys: overall_summary, product_or_main_subject, timeline_seconds, scenes, visible_actions, detected_text_ocr, emotional_tone, pacing, important_moments, suggested_hooks, weak_or_dead_spots, shot_categories, suggested_sound_effects, suggested_transitions, suggested_captions_overlay_text, suggested_cut_points, possible_product_benefits_shown_visually, script_timing_guidance, voiceover_beats.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Analyze these sampled video keyframes for reusable script, captions, hook, sound, transition, auto-cut, and timeline-label decisions.",
              chunkLabel ? `Chunk context: ${chunkLabel}` : "Chunk context: full sampled sequence.",
              `Keyframe timestamps: ${visionFrames.map((frame) => `${frame.timeSec}s`).join(", ")}`,
              timelineScenes.length
                ? `Studio timeline clip map: ${JSON.stringify(timelineScenes)}`
                : "No Studio timeline clip map is available; infer timing from keyframe timestamps.",
              "For script_timing_guidance and voiceover_beats, recommend short narration beats that align with the visible shot seconds.",
              "If the product or action is unclear, still return best-effort visual context and note uncertainty inside the relevant fields.",
            ].join("\n"),
          },
          ...visionFrames.map((frame) => ({
            type: "image_url",
            image_url: { url: frame.dataUrl, detail: "low" },
          })),
        ] as any,
      },
    ],
  });

  return parseJsonObject(response.choices[0]?.message?.content?.trim() || "{}");
}

async function mergeChunkAnalyses(
  chunkAnalyses: Record<string, unknown>[],
  model: string,
  timelineScenes: TimelineContextScene[],
  frameCount: number,
): Promise<Record<string, unknown>> {
  if (chunkAnalyses.length === 1) {
    return {
      ...chunkAnalyses[0],
      source_frame_count: frameCount,
      analysis_chunk_count: 1,
      sampling_interval_sec: KEYFRAME_INTERVAL_SEC,
    };
  }

  const client = createVisionClient();
  if (!client) {
    throw new Error("Missing OpenAI credentials for video analysis. Set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.");
  }

  const compactChunks = chunkAnalyses.map((analysis, index) => ({
    chunk: index + 1,
    analysis,
  }));

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    max_completion_tokens: 3200,
    messages: [
      {
        role: "system",
        content: [
          "You are Buzzly/Brandy's reusable Video Intelligence Layer.",
          "Merge chunk-level visual analyses into one full-video JSON analysis.",
          "Preserve time-aware details across the whole video and remove duplicates.",
          "Do not invent audio, dialogue, or unseen claims. Do not include markdown.",
          "Required JSON keys: overall_summary, product_or_main_subject, timeline_seconds, scenes, visible_actions, detected_text_ocr, emotional_tone, pacing, important_moments, suggested_hooks, weak_or_dead_spots, shot_categories, suggested_sound_effects, suggested_transitions, suggested_captions_overlay_text, suggested_cut_points, possible_product_benefits_shown_visually, script_timing_guidance, voiceover_beats, source_frame_count, analysis_chunk_count, sampling_interval_sec.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Frame count: ${frameCount}`,
          `Sampling interval seconds: ${KEYFRAME_INTERVAL_SEC}`,
          timelineScenes.length
            ? `Studio timeline clip map: ${JSON.stringify(timelineScenes)}`
            : "No Studio timeline clip map is available.",
          `Chunk analyses: ${JSON.stringify(compactChunks).slice(0, 50000)}`,
        ].join("\n"),
      },
    ],
  });

  const merged = parseJsonObject(response.choices[0]?.message?.content?.trim() || "{}");
  return {
    ...merged,
    source_frame_count: frameCount,
    analysis_chunk_count: chunkAnalyses.length,
    sampling_interval_sec: KEYFRAME_INTERVAL_SEC,
  };
}

async function analyzeKeyframeSequence(keyframes: KeyframeSample[], model: string, timelineScenes: TimelineContextScene[]): Promise<Record<string, unknown>> {
  const chunks = chunkKeyframes(keyframes);
  const analyses: Record<string, unknown>[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const firstFrame = chunk[0];
    const lastFrame = chunk[chunk.length - 1];
    const chunkLabel = `chunk ${index + 1} of ${chunks.length}, frames ${firstFrame?.timeSec ?? 0}s-${lastFrame?.timeSec ?? 0}s`;
    analyses.push(await analyzeKeyframes(chunk, model, timelineScenes, chunkLabel));
  }

  return mergeChunkAnalyses(analyses, model, timelineScenes, keyframes.length);
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
  options: { force?: boolean; model?: string; analysisVersion?: string; timelineJson?: Record<string, any> | null } = {},
): Promise<{ analysis: VideoAnalysis; reused: boolean; videoHash: string; source: AnalysisTarget["source"] }> {
  const model = options.model || VIDEO_ANALYSIS_MODEL;
  const analysisVersion = options.analysisVersion || VIDEO_ANALYSIS_VERSION;
  const target = await getAssetAnalysisTarget(asset);
  if (!target) {
    throw new Error("No video found to analyze. Upload or save a Studio video first.");
  }

  const workDir = await mkdtemp(join(tmpdir(), "video-analysis-source-"));
  const inputPath = join(workDir, "source.mp4");

  try {
    await downloadFileFromR2(target.r2Key, inputPath);
    const videoHash = await hashFileSha256(inputPath);

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

    const keyframeDir = await mkdtemp(join(tmpdir(), "video-analysis-frames-"));
    let analysisJson: Record<string, unknown>;
    try {
      const keyframes = await extractKeyframes(inputPath, keyframeDir);
      analysisJson = await analyzeKeyframeSequence(keyframes, model, buildTimelineContext(options.timelineJson || asset.timelineJson as Record<string, any> | null));
    } finally {
      await rm(keyframeDir, { recursive: true, force: true }).catch(() => {});
    }
    const analysis = await storage.createVideoAnalysis({
      videoAssetId: asset.id,
      videoHash,
      analysisJson,
      modelUsed: model,
      analysisVersion,
    });

    return { analysis, reused: false, videoHash, source: target.source };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function summarizeVideoAnalysisForPrompt(analysis?: VideoAnalysis | null): string {
  if (!analysis?.analysisJson) return "";
  return JSON.stringify(analysis.analysisJson).slice(0, 12000);
}

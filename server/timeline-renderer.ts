import ffmpegStatic from "ffmpeg-static";
import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { basename, join } from "path";
import { tmpdir } from "os";
import { downloadFileFromR2, uploadFileToR2 } from "./r2";
import { storage } from "./storage";

type TimelineSource = {
  r2Key?: string;
  uri?: string;
};

type TimelineItem = {
  id: string;
  type: string;
  name?: string;
  source?: TimelineSource;
  startTime?: number;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
};

type TimelineJson = {
  tracks?: Array<{
    id?: string;
    type?: string;
    items?: TimelineItem[];
  }>;
};

const STUDIO_RENDER_WIDTH = Math.max(360, parseInt(process.env.STUDIO_RENDER_WIDTH || "720", 10));
const STUDIO_RENDER_HEIGHT = Math.max(640, parseInt(process.env.STUDIO_RENDER_HEIGHT || "1280", 10));
const STUDIO_RENDER_PRESET = process.env.STUDIO_RENDER_PRESET || "veryfast";

const fitToStudioFrameFilter = (setPts: string) => (
  `scale=${STUDIO_RENDER_WIDTH}:${STUDIO_RENDER_HEIGHT}:force_original_aspect_ratio=decrease,` +
  `pad=${STUDIO_RENDER_WIDTH}:${STUDIO_RENDER_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,${setPts}`
);

function runFfmpeg(args: string[], timeoutMs = 600_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegStatic || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
      reject(new Error(`FFmpeg timed out after ${timeoutMs / 1000}s. Last output: ${stderr.slice(-800)}`));
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

const quoteConcatPath = (filePath: string) => `file '${filePath.replace(/'/g, "'\\''")}'`;

const itemCanUseAssetVideo = (item: TimelineItem, assetId: number, assetVideoKey?: string | null) => {
  if (!assetVideoKey) return false;
  const uri = item.source?.uri || "";
  const filename = item.source?.r2Key || item.source?.uri || "";
  const assetFilename = basename(assetVideoKey);
  return (
    uri.includes(`/api/assets/${assetId}/media/video`)
    || uri.includes(assetVideoKey)
    || uri.includes(assetFilename)
    || filename.includes(assetVideoKey)
    || filename.includes(assetFilename)
  );
};

const getTimelineVideoItems = (timelineJson: TimelineJson, assetId: number, assetVideoKey?: string | null) => (
  (timelineJson.tracks || [])
    .flatMap((track) => track.items || [])
    .filter((item) => item.type === "video" && (
      item.source?.r2Key
      || itemCanUseAssetVideo(item, assetId, assetVideoKey)
    ))
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
);

export async function renderTimelineVideo(assetId: number, timelineJson: TimelineJson): Promise<string> {
  const asset = await storage.getAsset(assetId);
  const videoItems = getTimelineVideoItems(timelineJson, assetId, asset?.videoKey);
  if (videoItems.length === 0) {
    throw new Error("No renderable Studio timeline video clips found");
  }

  const workDir = await mkdtemp(join(tmpdir(), `timeline-${assetId}-`));

  try {
    const renderedClips: string[] = [];

    for (let index = 0; index < videoItems.length; index++) {
      const item = videoItems[index];
      const sourceKey = item.source?.r2Key
        || (itemCanUseAssetVideo(item, assetId, asset?.videoKey) ? asset?.videoKey : undefined);
      if (!sourceKey) continue;

      const inputPath = join(workDir, `input_${index}.mp4`);
      const outputPath = join(workDir, `clip_${index}.mp4`);
      await downloadFileFromR2(sourceKey, inputPath);

      const trimStart = Math.max(0, Number(item.trimStart || 0));
      const timelineDuration = Number(item.duration || 0);
      const trimEnd = Number(item.trimEnd || 0);
      const duration = Math.max(0.1, timelineDuration || (trimEnd > trimStart ? trimEnd - trimStart : 5));
      const playbackRate = Math.max(0.25, Math.min(4, Number(item.playbackRate || 1)));
      const setPts = playbackRate === 1 ? "setpts=PTS" : `setpts=${(1 / playbackRate).toFixed(4)}*PTS`;

      await runFfmpeg([
        "-y",
        "-ss", String(trimStart),
        "-t", String(duration),
        "-i", inputPath,
        "-vf", fitToStudioFrameFilter(setPts),
        "-r", "30",
        "-c:v", "libx264", "-preset", STUDIO_RENDER_PRESET, "-crf", "24",
        "-threads", "1",
        "-pix_fmt", "yuv420p",
        "-an",
        outputPath,
      ]);

      renderedClips.push(outputPath);
    }

    if (renderedClips.length === 0) {
      throw new Error("Studio timeline clips could not be rendered");
    }

    const concatPath = join(workDir, "concat.txt");
    await writeFile(concatPath, renderedClips.map(quoteConcatPath).join("\n"));

    const outputPath = join(workDir, "studio-timeline.mp4");
    await runFfmpeg([
      "-y",
      "-f", "concat", "-safe", "0", "-i", concatPath,
      "-c:v", "libx264", "-preset", STUDIO_RENDER_PRESET, "-crf", "24",
      "-threads", "1",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ]);

    const r2Key = `timeline-renders/${assetId}/${Date.now()}.mp4`;
    await uploadFileToR2(r2Key, outputPath, "video/mp4");
    return r2Key;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

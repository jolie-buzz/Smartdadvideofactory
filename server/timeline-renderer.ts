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
  r2Key?: string;
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

const roundTime = (value: number) => Number(value.toFixed(3));

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

const getRenderableSourceKey = (item: TimelineItem, assetId: number, assetVideoKey?: string | null) => {
  if (item.source?.r2Key) return item.source.r2Key;
  if (item.r2Key) return item.r2Key;
  if (item.type === "video" && assetVideoKey) return assetVideoKey;
  if (itemCanUseAssetVideo(item, assetId, assetVideoKey)) return assetVideoKey || undefined;
  return undefined;
};

const getTimelineItems = (timelineJson: TimelineJson) => (
  (timelineJson.tracks || []).flatMap((track) => track.items || [])
);

const logTimelineRenderInputs = (assetId: number, timelineJson: TimelineJson, assetVideoKey?: string | null) => {
  const timelineItems = getTimelineItems(timelineJson);
  const videoItems = timelineItems.filter((item) => item.type === "video");
  console.info("[studio-render] timeline scan", {
    assetId,
    timelineClipCount: timelineItems.length,
    videoClipCount: videoItems.length,
    hasAssetVideoKey: Boolean(assetVideoKey),
    videoClips: videoItems.map((item) => ({
      id: item.id,
      name: item.name || null,
      hasSourceUri: Boolean(item.source?.uri),
      hasSourceR2Key: Boolean(item.source?.r2Key),
      hasTopLevelR2Key: Boolean(item.r2Key),
      hasAssetVideoKey: Boolean(assetVideoKey),
      sourceUriKind: item.source?.uri?.startsWith("blob:")
        ? "blob"
        : item.source?.uri?.startsWith("/api/media/r2")
          ? "r2-media-endpoint"
          : item.source?.uri
            ? "other"
            : "missing",
      renderable: Boolean(getRenderableSourceKey(item, assetId, assetVideoKey)),
    })),
  });
};

const getTimelineVideoItems = (timelineJson: TimelineJson, assetId: number, assetVideoKey?: string | null) => (
  getTimelineItems(timelineJson)
    .filter((item) => item.type === "video" && Boolean(getRenderableSourceKey(item, assetId, assetVideoKey)))
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
);

export async function renderTimelineVideo(assetId: number, timelineJson: TimelineJson): Promise<string> {
  const asset = await storage.getAsset(assetId);
  logTimelineRenderInputs(assetId, timelineJson, asset?.videoKey);
  const videoItems = getTimelineVideoItems(timelineJson, assetId, asset?.videoKey);
  if (videoItems.length === 0) {
    throw new Error("No renderable Studio timeline video clips found");
  }

  const workDir = await mkdtemp(join(tmpdir(), `timeline-${assetId}-`));

  try {
    const renderedClips: string[] = [];

    for (let index = 0; index < videoItems.length; index++) {
      const item = videoItems[index];
      const sourceKey = getRenderableSourceKey(item, assetId, asset?.videoKey);
      if (!sourceKey) continue;

      const inputPath = join(workDir, `input_${index}.mp4`);
      const outputPath = join(workDir, `clip_${index}.mp4`);
      await downloadFileFromR2(sourceKey, inputPath);

      const trimStart = Math.max(0, Number(item.trimStart || 0));
      const timelineDuration = Number(item.duration || 0);
      const trimEnd = Number(item.trimEnd || 0);
      const playbackRate = Math.max(0.25, Math.min(4, Number(item.playbackRate || 1)));
      const trimmedMediaDuration = trimEnd > trimStart ? trimEnd - trimStart : 0;
      const timelineMediaDuration = timelineDuration > 0 ? timelineDuration * playbackRate : 0;
      const sourceDuration = roundTime(Math.max(
        0.1,
        timelineMediaDuration && trimmedMediaDuration
          ? Math.min(timelineMediaDuration, trimmedMediaDuration)
          : timelineMediaDuration || trimmedMediaDuration || 5,
      ));
      const setPts = playbackRate === 1 ? "setpts=PTS" : `setpts=${(1 / playbackRate).toFixed(4)}*PTS`;

      await runFfmpeg([
        "-y",
        "-ss", String(trimStart),
        "-t", String(sourceDuration),
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

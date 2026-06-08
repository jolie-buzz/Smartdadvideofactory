import ffmpegStatic from "ffmpeg-static";
import { spawn } from "child_process";
import { mkdtemp, rm } from "fs/promises";
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
  position?: { x?: number; y?: number };
  frameSize?: { width?: number; height?: number };
  mediaFit?: "contain" | "cover";
  scale?: number;
  opacity?: number;
};

type TimelineJson = {
  project?: {
    duration?: number;
  };
  tracks?: Array<{
    id?: string;
    type?: string;
    items?: TimelineItem[];
  }>;
};

const STUDIO_RENDER_WIDTH = Math.max(360, parseInt(process.env.STUDIO_RENDER_WIDTH || "720", 10));
const STUDIO_RENDER_HEIGHT = Math.max(640, parseInt(process.env.STUDIO_RENDER_HEIGHT || "1280", 10));
const STUDIO_RENDER_PRESET = process.env.STUDIO_RENDER_PRESET || "veryfast";

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
  (timelineJson.tracks || [])
    .flatMap((track, trackIndex) => (track.items || []).map((item) => ({ item, trackIndex })))
    .filter(({ item }) => item.type === "video" && Boolean(getRenderableSourceKey(item, assetId, assetVideoKey)))
    .sort((a, b) => {
      if (a.trackIndex !== b.trackIndex) return b.trackIndex - a.trackIndex;
      return (a.item.startTime || 0) - (b.item.startTime || 0);
    })
);

const getTimelineDuration = (timelineJson: TimelineJson) => Math.max(
  0.1,
  Number(timelineJson.project?.duration || 0),
  ...getTimelineItems(timelineJson).map((item) => Number(item.startTime || 0) + Number(item.duration || 0)),
);

const getClipFrame = (item: TimelineItem) => {
  const scale = Math.max(0.05, Number(item.scale || 1));
  const frameWidth = Math.max(2, Math.round(STUDIO_RENDER_WIDTH * Math.max(0.05, Number(item.frameSize?.width || 1)) * scale));
  const frameHeight = Math.max(2, Math.round(STUDIO_RENDER_HEIGHT * Math.max(0.05, Number(item.frameSize?.height || 1)) * scale));
  const x = Math.round(STUDIO_RENDER_WIDTH * Math.max(0, Math.min(1, Number(item.position?.x ?? 0.5))) - frameWidth / 2);
  const y = Math.round(STUDIO_RENDER_HEIGHT * Math.max(0, Math.min(1, Number(item.position?.y ?? 0.5))) - frameHeight / 2);
  return { frameWidth, frameHeight, x, y };
};

const fitClipFilter = (item: TimelineItem, frameWidth: number, frameHeight: number) => (
  item.mediaFit === "contain"
    ? `scale=${frameWidth}:${frameHeight}:force_original_aspect_ratio=decrease,pad=${frameWidth}:${frameHeight}:(ow-iw)/2:(oh-ih)/2:black`
    : `scale=${frameWidth}:${frameHeight}:force_original_aspect_ratio=increase,crop=${frameWidth}:${frameHeight}`
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
    const ffmpegArgs = [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=black:s=${STUDIO_RENDER_WIDTH}x${STUDIO_RENDER_HEIGHT}:r=30:d=${getTimelineDuration(timelineJson)}`,
    ];
    const filterParts = ["[0:v]format=rgba[base0]"];
    let renderedInputCount = 0;

    for (let index = 0; index < videoItems.length; index++) {
      const item = videoItems[index].item;
      const sourceKey = getRenderableSourceKey(item, assetId, asset?.videoKey);
      if (!sourceKey) continue;

      const inputPath = join(workDir, `input_${index}.mp4`);
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
      const timelineStart = Math.max(0, Number(item.startTime || 0));
      const outputDuration = roundTime(Math.max(0.1, sourceDuration / playbackRate));
      const timelineEnd = roundTime(timelineStart + outputDuration);
      const ffmpegInputIndex = renderedInputCount + 1;
      const { frameWidth, frameHeight, x, y } = getClipFrame(item);
      const setPts = `setpts=${(1 / playbackRate).toFixed(4)}*(PTS-STARTPTS)+${timelineStart}/TB`;
      const opacity = Math.max(0, Math.min(1, Number(item.opacity ?? 1)));

      ffmpegArgs.push("-ss", String(trimStart), "-t", String(sourceDuration), "-i", inputPath);
      filterParts.push(
        `[${ffmpegInputIndex}:v]${setPts},${fitClipFilter(item, frameWidth, frameHeight)},format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[clip${renderedInputCount}]`,
        `[base${renderedInputCount}][clip${renderedInputCount}]overlay=${x}:${y}:enable='between(t,${timelineStart},${timelineEnd})':eof_action=pass:shortest=0[base${renderedInputCount + 1}]`,
      );
      renderedInputCount++;
    }

    if (renderedInputCount === 0) {
      throw new Error("Studio timeline clips could not be rendered");
    }

    const outputPath = join(workDir, "studio-timeline.mp4");
    await runFfmpeg([
      ...ffmpegArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", `[base${renderedInputCount}]`,
      "-t", String(getTimelineDuration(timelineJson)),
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

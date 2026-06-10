import { storage } from "./storage";
import { downloadFileFromR2, uploadFileToR2 } from "./r2";
import { spawn } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import ffmpegStatic from "ffmpeg-static";
import { logMemory, withHeavyWork } from "./heavy-work";

const BUILDER_RENDER_WIDTH = Math.max(360, parseInt(process.env.BUILDER_RENDER_WIDTH || "720", 10));
const BUILDER_RENDER_HEIGHT = Math.max(640, parseInt(process.env.BUILDER_RENDER_HEIGHT || "1280", 10));
const BUILDER_RENDER_PRESET = process.env.BUILDER_RENDER_PRESET || "veryfast";
const BUILDER_FRAME_FILTER = `scale=${BUILDER_RENDER_WIDTH}:${BUILDER_RENDER_HEIGHT}:force_original_aspect_ratio=decrease,pad=${BUILDER_RENDER_WIDTH}:${BUILDER_RENDER_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`;

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegStatic || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on("error", reject);
  });
}

const TEMPLATES: Record<number, { hook: number; problem: number; solution: number; highlight: number; bodyCount: number; bodyDur: number; cta: number }> = {
  45: { hook: 3, problem: 1.5, solution: 1.5, highlight: 3, bodyCount: 6, bodyDur: 6, cta: 0 },
  60: { hook: 3, problem: 1.5, solution: 1.5, highlight: 3, bodyCount: 8, bodyDur: 6, cta: 3 },
};

async function renderVariantUnlocked(variantId: number): Promise<void> {
  const variant = await storage.getVariant(variantId);
  if (!variant) throw new Error("Variant not found");

  const clipIds = variant.clipIds as number[];
  const shots = await storage.getShotsByIds(clipIds);
  const shotMap = new Map(shots.map(s => [s.id, s]));

  const template = TEMPLATES[variant.templateDuration] || TEMPLATES[45];
  const workDir = await mkdtemp(join(tmpdir(), `variant-${variantId}-`));

  try {
    const clipPaths: string[] = [];
    const durations: number[] = [];

    const orderedShots = clipIds.map(id => shotMap.get(id)).filter(Boolean);

    let idx = 0;
    for (const shot of orderedShots) {
      if (!shot) continue;
      const clipPath = join(workDir, `clip_${idx}.mp4`);
      logMemory("variant-render: before r2 download", { variantId, shotId: shot.id, key: shot.r2Key });
      await downloadFileFromR2(shot.r2Key, clipPath);
      logMemory("variant-render: after r2 download", { variantId, shotId: shot.id, key: shot.r2Key });

      let targetDur: number;
      if (idx === 0) targetDur = template.hook;
      else if (idx === 1) targetDur = template.problem;
      else if (idx === 2) targetDur = template.solution;
      else if (idx === 3) targetDur = template.highlight;
      else if (idx === orderedShots.length - 1 && template.cta > 0) targetDur = template.cta;
      else targetDur = template.bodyDur;

      const trimmedPath = join(workDir, `trimmed_${idx}.mp4`);
      logMemory("variant-render: before clip ffmpeg", { variantId, shotId: shot.id });
      await runFFmpeg([
        "-y", "-i", clipPath,
        "-t", targetDur.toString(),
        "-vf", BUILDER_FRAME_FILTER,
        "-r", "30",
        "-c:v", "libx264", "-preset", BUILDER_RENDER_PRESET, "-crf", "24",
        "-threads", "1",
        "-an",
        trimmedPath,
      ]);
      logMemory("variant-render: after clip ffmpeg", { variantId, shotId: shot.id });

      clipPaths.push(trimmedPath);
      durations.push(targetDur);
      idx++;
    }

    const concatListPath = join(workDir, "concat.txt");
    const concatContent = clipPaths.map(p => `file '${p}'`).join("\n");
    await writeFile(concatListPath, concatContent);

    const outputPath = join(workDir, "output.mp4");
    logMemory("variant-render: before concat ffmpeg", { variantId });
    await runFFmpeg([
      "-y", "-f", "concat", "-safe", "0", "-i", concatListPath,
      "-c:v", "libx264", "-preset", BUILDER_RENDER_PRESET, "-crf", "24",
      "-threads", "1",
      "-movflags", "+faststart",
      outputPath,
    ]);
    logMemory("variant-render: after concat ffmpeg", { variantId });

    const r2Key = `variants/${variant.assetId}/${variantId}.mp4`;
    logMemory("variant-render: before r2 upload", { variantId, key: r2Key });
    await uploadFileToR2(r2Key, outputPath, "video/mp4");
    logMemory("variant-render: after r2 upload", { variantId, key: r2Key });

    await storage.updateVariant(variantId, { r2Key, status: "done" });
  } catch (err) {
    await storage.updateVariant(variantId, { status: "failed" });
    throw err;
  } finally {
    const fsPromises = await import("fs/promises");
    try {
      const files = await fsPromises.readdir(workDir);
      for (const f of files) {
        await unlink(join(workDir, f)).catch(() => {});
      }
      await fsPromises.rmdir(workDir).catch(() => {});
    } catch {}
    logMemory("variant-render: cleanup", { variantId });
  }
}

export async function renderVariant(variantId: number): Promise<void> {
  return withHeavyWork(`variant-render id=${variantId}`, () => renderVariantUnlocked(variantId));
}

import { storage } from "./storage";
import { downloadFromR2, uploadToR2 } from "./r2";
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
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

export async function renderVariant(variantId: number): Promise<void> {
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
      const buffer = await downloadFromR2(shot.r2Key);
      await writeFile(clipPath, buffer);

      let targetDur: number;
      if (idx === 0) targetDur = template.hook;
      else if (idx === 1) targetDur = template.problem;
      else if (idx === 2) targetDur = template.solution;
      else if (idx === 3) targetDur = template.highlight;
      else if (idx === orderedShots.length - 1 && template.cta > 0) targetDur = template.cta;
      else targetDur = template.bodyDur;

      const trimmedPath = join(workDir, `trimmed_${idx}.mp4`);
      await runFFmpeg([
        "-y", "-i", clipPath,
        "-t", targetDur.toString(),
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
        "-r", "30",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-an",
        trimmedPath,
      ]);

      clipPaths.push(trimmedPath);
      durations.push(targetDur);
      idx++;
    }

    const concatListPath = join(workDir, "concat.txt");
    const concatContent = clipPaths.map(p => `file '${p}'`).join("\n");
    await writeFile(concatListPath, concatContent);

    const outputPath = join(workDir, "output.mp4");
    await runFFmpeg([
      "-y", "-f", "concat", "-safe", "0", "-i", concatListPath,
      "-c:v", "libx264", "-preset", "fast", "-crf", "23",
      "-movflags", "+faststart",
      outputPath,
    ]);

    const outputBuffer = await readFile(outputPath);
    const r2Key = `variants/${variant.assetId}/${variantId}.mp4`;
    await uploadToR2(r2Key, outputBuffer, "video/mp4");

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
  }
}

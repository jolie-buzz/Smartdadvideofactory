import { storage } from "./storage";
import { uploadToR2, downloadFromR2, getSignedDownloadUrl } from "./r2";
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import OpenAI from "openai";

const openai = new OpenAI(
  process.env.OPENAI_API_KEY
    ? { apiKey: process.env.OPENAI_API_KEY }
    : {
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      }
);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

async function generateScript(personaPrompt: string, photoUrl: string | null, model: string): Promise<string> {
  const systemMessage = `You are a SmartDad video script writer. Write scripts in Taglish (Tagalog-English mix) tone that are easy to narrate and engaging for social media video ads.

Follow this exact format:
- Line 1: An unskippable hook line (attention-grabbing, makes viewer stop scrolling)
- Lines 2-8: 6-10 short, easy-to-narrate lines about the product benefits and features
- Last line: A hard call-to-action (CTA) line

Rules:
- Keep each line short and punchy (max 15 words per line)
- Use conversational Taglish tone
- Output ONLY the script lines, one per line, no numbering, no labels
- No stage directions or notes
- If a product image is provided, use the visible product details, branding, text, and features from the image to make the script accurate and specific`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  if (photoUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: photoUrl },
    });
  }

  userContent.push({
    type: "text",
    text: personaPrompt,
  });

  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userContent as any },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

async function generateVoice(scriptText: string, voiceId: string, elevenlabsModel: string): Promise<Buffer> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY!,
    },
    body: JSON.stringify({
      text: scriptText,
      model_id: elevenlabsModel,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
    });
    proc.on("error", reject);
  });
}

async function cutDeadAir(
  audioBuffer: Buffer,
  thresholdDb: number,
  removeSilencesLongerThan: number,
  ignoreDetectionsShorterThan: number,
  workDir: string
): Promise<Buffer> {
  const inputPath = join(workDir, "voice_raw.mp3");
  const outputPath = join(workDir, "voice_clean.mp3");

  await writeFile(inputPath, audioBuffer);

  const silenceFilter = `silenceremove=stop_periods=-1:stop_duration=${removeSilencesLongerThan}:stop_threshold=${thresholdDb}dB:window=${ignoreDetectionsShorterThan}`;

  await runFfmpeg([
    "-i", inputPath,
    "-af", silenceFilter,
    "-y",
    outputPath,
  ]);

  return readFile(outputPath);
}

async function combineVideoAudio(
  videoBuffer: Buffer,
  audioBuffer: Buffer,
  workDir: string
): Promise<Buffer> {
  const videoPath = join(workDir, "input_video.mp4");
  const audioPath = join(workDir, "voice_clean.mp3");
  const outputPath = join(workDir, "final.mp4");

  await writeFile(videoPath, videoBuffer);
  await writeFile(audioPath, audioBuffer);

  await runFfmpeg([
    "-i", videoPath,
    "-i", audioPath,
    "-c:v", "copy",
    "-c:a", "aac",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-shortest",
    "-y",
    outputPath,
  ]);

  return readFile(outputPath);
}

async function processJob(jobId: number): Promise<void> {
  const job = await storage.getJob(jobId);
  if (!job) return;

  const asset = await storage.getAsset(job.assetId);
  if (!asset) {
    await storage.updateJob(jobId, { status: "failed" });
    await storage.appendJobLog(jobId, "Asset not found");
    return;
  }

  const workDir = await mkdtemp(join(tmpdir(), `job-${jobId}-`));

  try {
    await storage.updateJob(jobId, { status: "generating_script" });
    await storage.appendJobLog(jobId, `Generating script with OpenAI (model: ${asset.openaiModel})...`);

    let photoUrl: string | null = null;
    try {
      photoUrl = await getSignedDownloadUrl(asset.photoKey);
      await storage.appendJobLog(jobId, "Product photo included for vision analysis");
    } catch (err: any) {
      await storage.appendJobLog(jobId, `Warning: Could not get photo URL: ${err.message}`);
    }

    const scriptText = await generateScript(asset.personaPrompt, photoUrl, asset.openaiModel);
    await storage.updateJob(jobId, { scriptText });
    await storage.appendJobLog(jobId, `Script generated (${scriptText.split("\n").length} lines)`);

    await storage.updateJob(jobId, { status: "generating_audio" });
    await storage.appendJobLog(jobId, `Generating voice with ElevenLabs (voice: ${asset.voiceId})...`);

    if (!asset.voiceId) {
      throw new Error("No voice selected for this asset setup");
    }

    const audioRawBuffer = await generateVoice(scriptText, asset.voiceId, asset.elevenlabsModel);
    const audioRawKey = `jobs/${jobId}/voice_raw.mp3`;
    await uploadToR2(audioRawKey, audioRawBuffer, "audio/mpeg");
    await storage.updateJob(jobId, { audioRawKey });
    await storage.appendJobLog(jobId, `Raw audio uploaded (${(audioRawBuffer.length / 1024).toFixed(1)} KB)`);

    await storage.updateJob(jobId, { status: "cutting_dead_air" });
    await storage.appendJobLog(jobId, `Cutting dead air (threshold: ${asset.thresholdDb}dB, min silence: ${asset.ignoreDetectionsShorterThan}s)...`);

    const audioCleanBuffer = await cutDeadAir(
      audioRawBuffer,
      asset.thresholdDb,
      asset.removeSilencesLongerThan,
      asset.ignoreDetectionsShorterThan,
      workDir
    );
    const audioCleanKey = `jobs/${jobId}/voice_clean.mp3`;
    await uploadToR2(audioCleanKey, audioCleanBuffer, "audio/mpeg");
    await storage.updateJob(jobId, { audioCleanKey });
    await storage.appendJobLog(jobId, `Clean audio uploaded (${(audioCleanBuffer.length / 1024).toFixed(1)} KB)`);

    await storage.updateJob(jobId, { status: "rendering" });
    await storage.appendJobLog(jobId, "Downloading video from R2...");

    const videoBuffer = await downloadFromR2(asset.videoKey);
    await storage.appendJobLog(jobId, "Combining video + clean audio...");

    const finalVideoBuffer = await combineVideoAudio(videoBuffer, audioCleanBuffer, workDir);
    const finalVideoKey = `jobs/${jobId}/final.mp4`;
    await uploadToR2(finalVideoKey, finalVideoBuffer, "video/mp4");
    await storage.updateJob(jobId, { finalVideoKey, status: "done" });
    await storage.appendJobLog(jobId, `Final video uploaded (${(finalVideoBuffer.length / 1024 / 1024).toFixed(2)} MB). Done!`);
  } catch (err: any) {
    console.error(`Job ${jobId} failed:`, err);
    await storage.updateJob(jobId, { status: "failed" });
    await storage.appendJobLog(jobId, `FAILED: ${err.message || String(err)}`);
  } finally {
    const { rm } = await import("fs/promises");
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

let workerRunning = false;

async function pollJobs() {
  if (workerRunning) return;
  workerRunning = true;

  try {
    const allJobs = await storage.getJobs();
    const queued = allJobs.filter((j) => j.status === "queued");
    for (const job of queued) {
      await processJob(job.id);
    }
  } catch (err) {
    console.error("Worker poll error:", err);
  } finally {
    workerRunning = false;
  }
}

export function startWorker() {
  console.log("[worker] Background worker started (polling every 3s)");
  setInterval(pollJobs, 3000);
}

import { storage } from "./storage";
import { uploadToR2, downloadFromR2, getSignedDownloadUrl } from "./r2";
import { renderVariant } from "./video-builder";
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

const openaiDirect = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

async function generateScript(personaPrompt: string, photoUrl: string | null, model: string): Promise<string> {
  const systemMessage = `You are a SmartDad video script writer. Write scripts in Taglish (Tagalog-English mix) tone that are easy to narrate and engaging for social media video ads.

IMPORTANT: The script MUST be short enough to be narrated in 45 seconds or less when read aloud at a natural pace. Aim for 80-100 words total.

Follow this exact format:
- Line 1: An unskippable hook line (attention-grabbing, makes viewer stop scrolling)
- Lines 2-6: 4-6 short, easy-to-narrate lines about the product benefits and features
- Last line: A hard call-to-action (CTA) line

Rules:
- Keep each line short and punchy (max 12 words per line)
- Total script: 6-8 lines only, 80-100 words max
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

async function generateVoice(scriptText: string, voiceId: string, elevenlabsModel: string, useEnhance: boolean): Promise<Buffer> {
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
        use_speaker_boost: useEnhance,
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

function runFfmpeg(args: string[], timeoutMs: number = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${timeoutMs / 1000}s. Last output: ${stderr.slice(-500)}`));
    }, timeoutMs);

    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1000)}`));
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      if (!killed) reject(err);
    });
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
  workDir: string,
  musicBuffer?: Buffer | null,
  voiceVolume: number = 1.0,
  musicVolume: number = 0.3
): Promise<Buffer> {
  const videoPath = join(workDir, "input_video.mp4");
  const audioPath = join(workDir, "voice_clean.mp3");
  const outputPath = join(workDir, "final.mp4");

  await writeFile(videoPath, videoBuffer);
  await writeFile(audioPath, audioBuffer);

  if (musicBuffer) {
    const musicPath = join(workDir, "music.mp3");
    await writeFile(musicPath, musicBuffer);

    await runFfmpeg([
      "-i", videoPath,
      "-i", audioPath,
      "-i", musicPath,
      "-filter_complex",
      `[1:a]volume=${voiceVolume}[voice];[2:a]volume=${musicVolume},aloop=loop=-1:size=44100*60*30[musicloop];[voice][musicloop]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
      "-map", "0:v:0",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      "-y",
      outputPath,
    ]);
  } else {
    await runFfmpeg([
      "-i", videoPath,
      "-i", audioPath,
      "-filter_complex",
      `[1:a]volume=${voiceVolume}[aout]`,
      "-map", "0:v:0",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      "-y",
      outputPath,
    ]);
  }

  return readFile(outputPath);
}

async function transcribeAudio(audioBuffer: Buffer, workDir: string): Promise<string> {
  const audioPath = join(workDir, "voice_for_srt.mp3");
  await writeFile(audioPath, audioBuffer);

  const fs = await import("fs");
  const transcription = await openaiDirect.audio.transcriptions.create({
    file: fs.createReadStream(audioPath) as any,
    model: "whisper-1",
    response_format: "srt",
  });

  return transcription as unknown as string;
}

async function burnCaptions(
  videoBuffer: Buffer,
  srtContent: string,
  workDir: string
): Promise<Buffer> {
  const videoPath = join(workDir, "video_for_captions.mp4");
  const srtPath = join(workDir, "captions.srt");
  const outputPath = join(workDir, "video_captioned.mp4");

  await writeFile(videoPath, videoBuffer);
  await writeFile(srtPath, "\uFEFF" + srtContent, "utf-8");

  const escapedSrtPath = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  await runFfmpeg([
    "-i", videoPath,
    "-vf", `subtitles='${escapedSrtPath}':force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=30,FontName=FreeSans'`,
    "-c:a", "copy",
    "-y",
    outputPath,
  ], 180_000);

  return readFile(outputPath);
}

async function generateHookHeadline(personaPrompt: string, hookPrompt: string | null, photoUrl: string | null, model: string): Promise<string> {
  const systemMsg = `You are a social media hook headline generator. Generate a short, attention-grabbing headline (5-8 words max) in Taglish that makes viewers stop scrolling. Output ONLY the headline text, nothing else. If a product image is provided, use the visible product details, branding, and features from the image to craft a more specific and compelling headline.`;

  const textMsg = hookPrompt
    ? `Product context: ${personaPrompt}\n\nHook instruction: ${hookPrompt}`
    : `Generate an unskippable hook headline for this product: ${personaPrompt}`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  if (photoUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: photoUrl },
    });
  }

  userContent.push({
    type: "text",
    text: textMsg,
  });

  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: 100,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userContent as any },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "MUST WATCH!";
}

async function generateCaption(personaPrompt: string, captionPrompt: string | null, photoUrl: string | null, model: string): Promise<string> {
  const systemMsg = `You are a social media caption writer. Generate an engaging, scroll-stopping caption in Taglish (Tagalog-English mix) for a product post. Include relevant emojis. The caption should be ready to copy-paste directly to social media (Facebook, Instagram, TikTok). Output ONLY the caption text, nothing else. If a product image is provided, use the visible product details, branding, and features to make the caption specific and compelling.`;

  const textMsg = captionPrompt
    ? `Product context: ${personaPrompt}\n\nCaption instruction: ${captionPrompt}`
    : `Generate a social media caption for this product: ${personaPrompt}`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (photoUrl) userContent.push({ type: "image_url", image_url: { url: photoUrl } });
  userContent.push({ type: "text", text: textMsg });

  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: 500,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userContent as any },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

async function generateSeoKeywords(personaPrompt: string, seoPrompt: string | null, photoUrl: string | null, model: string): Promise<string> {
  const systemMsg = `You are an SEO and social media keyword specialist. Generate relevant hashtags and SEO keywords for a product post. Output a mix of popular and niche hashtags (15-25 hashtags) plus 5-10 SEO keywords. Format: hashtags on the first section (each starting with #), then SEO keywords below. Make them ready to copy-paste. If a product image is provided, use the visible product details and features. Use Taglish and English tags for maximum reach.`;

  const textMsg = seoPrompt
    ? `Product context: ${personaPrompt}\n\nSEO instruction: ${seoPrompt}`
    : `Generate hashtags and SEO keywords for this product: ${personaPrompt}`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (photoUrl) userContent.push({ type: "image_url", image_url: { url: photoUrl } });
  userContent.push({ type: "text", text: textMsg });

  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: 500,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userContent as any },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
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
    if (asset.videoSource === "builder" && (!asset.videoKey || asset.videoKey === "")) {
      await storage.updateJob(jobId, { status: "building_video" });
      await storage.appendJobLog(jobId, "Video Builder mode: auto-generating variant from shot library...");

      const allShots = await storage.getShots(asset.id);
      if (allShots.length === 0) {
        throw new Error("No shots uploaded for this Video Builder setup. Upload shot clips first.");
      }

      const recentClipIds = await storage.getRecentVariantClipIds(asset.id, 10);
      const shotsByCategory: Record<string, typeof allShots> = {};
      for (const s of allShots) {
        if (!shotsByCategory[s.category]) shotsByCategory[s.category] = [];
        shotsByCategory[s.category].push(s);
      }

      const hookShots = shotsByCategory["HOOK"] || [];
      const problemShots = shotsByCategory["PROBLEM"] || [];
      const solutionShots = shotsByCategory["SOLUTION"] || [];
      const highlightShots = shotsByCategory["HIGHLIGHT"] || [];
      const bodyShots = shotsByCategory["BODY"] || [];
      const ctaShots = shotsByCategory["CTA"] || [];

      if (hookShots.length === 0) throw new Error("At least 1 HOOK shot is required");
      if (bodyShots.length < 4) throw new Error("At least 4 BODY shots with distinct shotTypes are required");

      const templateDuration = 45;
      const bodyCount = 6;
      const usedIds = new Set<number>();
      const clipIds: number[] = [];

      const pick = (pool: typeof allShots, fallback?: typeof allShots): number | null => {
        const preferred = pool.filter(s => !usedIds.has(s.id) && !recentClipIds.includes(s.id));
        const available = preferred.length > 0 ? preferred : pool.filter(s => !usedIds.has(s.id));
        if (available.length === 0 && fallback) {
          const fb = fallback.filter(s => !usedIds.has(s.id));
          if (fb.length > 0) { const c = fb[Math.floor(Math.random() * fb.length)]; usedIds.add(c.id); return c.id; }
          return null;
        }
        if (available.length === 0) return null;
        const c = available[Math.floor(Math.random() * available.length)];
        usedIds.add(c.id);
        return c.id;
      };

      const hookId = pick(hookShots); if (hookId) clipIds.push(hookId);
      const problemId = pick(problemShots, hookShots); if (problemId) clipIds.push(problemId);
      const solutionId = pick(solutionShots, highlightShots); if (solutionId) clipIds.push(solutionId);
      const highlightId = pick(highlightShots, bodyShots); if (highlightId) clipIds.push(highlightId);

      const usedBodyTypes = new Set<string>();
      for (let b = 0; b < bodyCount; b++) {
        let pool: typeof allShots;
        if (usedBodyTypes.size < 4) {
          pool = bodyShots.filter(s => !usedIds.has(s.id) && s.shotType && !usedBodyTypes.has(s.shotType));
          if (pool.length === 0) pool = bodyShots.filter(s => !usedIds.has(s.id));
        } else {
          pool = bodyShots.filter(s => !usedIds.has(s.id));
        }
        const preferred = pool.filter(s => !recentClipIds.includes(s.id));
        const candidates = preferred.length > 0 ? preferred : pool;
        if (candidates.length === 0) break;
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        usedIds.add(chosen.id);
        if (chosen.shotType) usedBodyTypes.add(chosen.shotType);
        clipIds.push(chosen.id);
      }

      if (ctaShots.length > 0) {
        const ctaId = pick(ctaShots, bodyShots);
        if (ctaId) clipIds.push(ctaId);
      }

      const variant = await storage.createVariant({
        assetId: asset.id,
        templateDuration,
        clipIds,
        status: "rendering",
      });

      await storage.appendJobLog(jobId, `Variant #${variant.id} created with ${clipIds.length} clips. Rendering...`);

      await renderVariant(variant.id);

      const renderedVariant = await storage.getVariant(variant.id);
      if (!renderedVariant?.r2Key) {
        throw new Error("Variant rendering failed - no output file");
      }

      await storage.updateAsset(asset.id, { videoKey: renderedVariant.r2Key });
      const updatedAsset = await storage.getAsset(asset.id);
      if (updatedAsset) Object.assign(asset, updatedAsset);

      await storage.appendJobLog(jobId, `Video built and ready. Continuing pipeline...`);
    }

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

    const audioRawBuffer = await generateVoice(scriptText, asset.voiceId, asset.elevenlabsModel, asset.useEnhance);
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

    let musicBuffer: Buffer | null = null;
    if (asset.musicKey) {
      await storage.appendJobLog(jobId, "Downloading background music from R2...");
      musicBuffer = await downloadFromR2(asset.musicKey);
      await storage.appendJobLog(jobId, `Music downloaded (${(musicBuffer.length / 1024).toFixed(1)} KB)`);
    }

    await storage.appendJobLog(jobId, `Combining video + audio (voice vol: ${asset.voiceVolume}, music vol: ${asset.musicVolume})...`);
    let finalVideoBuffer = await combineVideoAudio(videoBuffer, audioCleanBuffer, workDir, musicBuffer, asset.voiceVolume, asset.musicVolume);

    if (asset.autoCaptions) {
      await storage.appendJobLog(jobId, "Generating captions via AI transcription...");
      try {
        const srtContent = await transcribeAudio(audioCleanBuffer, workDir);
        await storage.appendJobLog(jobId, "Burning captions into video...");
        finalVideoBuffer = await burnCaptions(finalVideoBuffer, srtContent, workDir);
        await storage.appendJobLog(jobId, "Captions added successfully");
      } catch (err: any) {
        await storage.appendJobLog(jobId, `Warning: Caption generation failed: ${err.message}. Continuing without captions.`);
      }
    }

    if (asset.hookHeadline) {
      await storage.appendJobLog(jobId, "Generating hook headline via AI...");
      try {
        const headline = await generateHookHeadline(asset.personaPrompt, asset.hookPrompt, photoUrl, asset.hookModel || asset.openaiModel);
        await storage.updateJob(jobId, { headlineText: headline });
        await storage.appendJobLog(jobId, `Hook headline generated: "${headline}"`);
      } catch (err: any) {
        await storage.appendJobLog(jobId, `Warning: Headline generation failed: ${err.message}`);
      }
    }

    if (asset.captionEnabled) {
      await storage.appendJobLog(jobId, "Generating social media caption via AI...");
      try {
        const caption = await generateCaption(asset.personaPrompt, asset.captionPrompt, photoUrl, asset.captionModel || asset.openaiModel);
        await storage.updateJob(jobId, { captionText: caption });
        await storage.appendJobLog(jobId, "Caption generated successfully");
      } catch (err: any) {
        await storage.appendJobLog(jobId, `Warning: Caption generation failed: ${err.message}`);
      }
    }

    if (asset.seoEnabled) {
      await storage.appendJobLog(jobId, "Generating SEO keywords & hashtags via AI...");
      try {
        const seo = await generateSeoKeywords(asset.personaPrompt, asset.seoPrompt, photoUrl, asset.seoModel || asset.openaiModel);
        await storage.updateJob(jobId, { seoText: seo });
        await storage.appendJobLog(jobId, "SEO keywords generated successfully");
      } catch (err: any) {
        await storage.appendJobLog(jobId, `Warning: SEO generation failed: ${err.message}`);
      }
    }

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

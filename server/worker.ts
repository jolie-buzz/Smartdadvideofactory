import { storage } from "./storage";
import { uploadToR2, downloadFromR2, getSignedDownloadUrl } from "./r2";
import { renderVariant } from "./video-builder";
import { spawn } from "child_process";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import OpenAI from "openai";

function createLlmClient(): OpenAI | null {
  if (process.env.DEEPSEEK_API_KEY) {
    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    });
  }

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

const llmClient = createLlmClient();

function getLlmClient(): OpenAI {
  if (!llmClient) {
    throw new Error("Missing LLM credentials. Set DEEPSEEK_API_KEY, OPENAI_API_KEY, or AI_INTEGRATIONS_OPENAI_API_KEY.");
  }

  return llmClient;
}

const transcriptionClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      })
    : null;

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

async function generateScript(personaPrompt: string, photoUrl: string | null, model: string, excludedWords?: string | null): Promise<string> {
  let systemMessage = `You are a Buzzly video script writer. Write scripts in Taglish (Tagalog-English mix) tone that are easy to narrate and engaging for social media video ads.

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

  if (excludedWords && excludedWords.trim()) {
    systemMessage += `\n\nIMPORTANT — NEVER use any of the following words or phrases anywhere in the script: ${excludedWords.trim()}`;
  }

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

  const response = await getLlmClient().chat.completions.create({
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

function runFfmpeg(args: string[], timeoutMs: number = 600_000): Promise<string> {
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

/**
 * Single FFmpeg pass: silenceremove voice + mix with video (streamed from R2 URL) + optional music.
 * No local video download needed — FFmpeg reads directly from the presigned URL.
 */
async function combineAllInOne(
  voicePath: string,
  videoUrl: string,
  musicUrl: string | null,
  outputPath: string,
  settings: {
    thresholdDb: number;
    removeSilencesLongerThan: number;
    ignoreDetectionsShorterThan: number;
    voiceVolume: number;
    musicVolume: number;
  }
): Promise<void> {
  const { thresholdDb, removeSilencesLongerThan, ignoreDetectionsShorterThan, voiceVolume, musicVolume } = settings;
  const silenceFilter = `silenceremove=stop_periods=-1:stop_duration=${removeSilencesLongerThan}:stop_threshold=${thresholdDb}dB:window=${ignoreDetectionsShorterThan}`;

  const args: string[] = [
    "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
    "-i", videoUrl,
    "-i", voicePath,
  ];

  if (musicUrl) {
    args.push("-i", musicUrl);
    args.push(
      "-filter_complex",
      `[1:a]${silenceFilter},volume=${voiceVolume}[voice];[2:a]volume=${musicVolume},aloop=loop=-1:size=44100*60*30[musicloop];[voice][musicloop]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
      "-map", "0:v:0",
      "-map", "[aout]",
    );
  } else {
    args.push(
      "-filter_complex",
      `[1:a]${silenceFilter},volume=${voiceVolume}[aout]`,
      "-map", "0:v:0",
      "-map", "[aout]",
      "-shortest",
    );
  }

  args.push(
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  );

  await runFfmpeg(args, 600_000);
}

async function transcribeAudio(audioBuffer: Buffer, workDir: string): Promise<string> {
  const audioPath = join(workDir, "voice_for_srt.mp3");
  await writeFile(audioPath, audioBuffer);

  const fs = await import("fs");
  if (!transcriptionClient) {
    throw new Error("Missing OpenAI credentials for captions transcription. Set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.");
  }

  const transcription = await transcriptionClient.audio.transcriptions.create({
    file: fs.createReadStream(audioPath) as any,
    model: "whisper-1",
    response_format: "srt",
  });

  return transcription as unknown as string;
}

async function burnCaptionsToFile(
  inputVideoPath: string,
  srtContent: string,
  outputVideoPath: string,
  workDir: string
): Promise<void> {
  const srtPath = join(workDir, "captions.srt");
  await writeFile(srtPath, "\uFEFF" + srtContent, "utf-8");

  const escapedSrtPath = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  await runFfmpeg([
    "-i", inputVideoPath,
    "-vf", `subtitles='${escapedSrtPath}':force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=30,FontName=FreeSans'`,
    "-c:a", "copy",
    "-y",
    outputVideoPath,
  ], 180_000);
}

async function generateHookHeadline(hookPrompt: string | null, photoUrl: string | null, model: string): Promise<string> {
  const systemMsg = `You are a social media hook headline generator. Generate a short, attention-grabbing headline (5-8 words max) in Taglish that makes viewers stop scrolling. Output ONLY the headline text, nothing else. You MUST analyze the product image provided to identify the product, its branding, features, and details — then craft a specific and compelling headline based on what you see in the image.`;

  const textMsg = hookPrompt
    ? `Hook instruction: ${hookPrompt}`
    : `Generate an unskippable hook headline based on the product in the image.`;

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

  const response = await getLlmClient().chat.completions.create({
    model,
    max_completion_tokens: 100,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userContent as any },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "MUST WATCH!";
}

async function generateCaption(captionPrompt: string | null, photoUrl: string | null, model: string): Promise<string> {
  const systemMsg = `You are a social media caption writer. Generate an engaging, scroll-stopping caption in Taglish (Tagalog-English mix) for a product post. Include relevant emojis. The caption should be ready to copy-paste directly to social media (Facebook, Instagram, TikTok). Output ONLY the caption text, nothing else. You MUST analyze the product image provided to identify the product, its branding, features, and details — then write a specific and compelling caption based on what you see in the image.`;

  const textMsg = captionPrompt
    ? `Caption instruction: ${captionPrompt}`
    : `Generate a social media caption based on the product in the image.`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (photoUrl) userContent.push({ type: "image_url", image_url: { url: photoUrl } });
  userContent.push({ type: "text", text: textMsg });

  const response = await getLlmClient().chat.completions.create({
    model,
    max_completion_tokens: 500,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userContent as any },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

async function generateSeoKeywords(seoPrompt: string | null, photoUrl: string | null, model: string): Promise<string> {
  const systemMsg = `You are an SEO and social media keyword specialist. Generate relevant hashtags and SEO keywords for a product post. Output a mix of popular and niche hashtags (15-25 hashtags) plus 5-10 SEO keywords. Format: hashtags on the first section (each starting with #), then SEO keywords below. Make them ready to copy-paste. You MUST analyze the product image provided to identify the product, its branding, features, and details — then generate hashtags and keywords based on what you see in the image. Use Taglish and English tags for maximum reach.`;

  const textMsg = seoPrompt
    ? `SEO instruction: ${seoPrompt}`
    : `Generate hashtags and SEO keywords based on the product in the image.`;

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (photoUrl) userContent.push({ type: "image_url", image_url: { url: photoUrl } });
  userContent.push({ type: "text", text: textMsg });

  const response = await getLlmClient().chat.completions.create({
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

  // Immediately lock this job so no other poll cycle can re-pick it
  await storage.updateJob(jobId, { status: "processing" });

  const workDir = await mkdtemp(join(tmpdir(), `job-${jobId}-`));

  try {
    // ── Video Builder: auto-generate variant if needed ──────────────────────
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

    // ── Step 1: Generate script ──────────────────────────────────────────────
    await storage.updateJob(jobId, { status: "generating_script" });
    await storage.appendJobLog(jobId, `Generating script with OpenAI (model: ${asset.openaiModel})...`);

    let photoUrl: string | null = null;
    try {
      photoUrl = await getSignedDownloadUrl(asset.photoKey);
      await storage.appendJobLog(jobId, "Product photo included for vision analysis");
    } catch (err: any) {
      await storage.appendJobLog(jobId, `Warning: Could not get photo URL: ${err.message}`);
    }

    const excludedWords = job.userId ? await storage.getExcludedWords(job.userId) : null;
    if (excludedWords && excludedWords.trim()) {
      await storage.appendJobLog(jobId, "Applying excluded words filter");
    }

    const scriptText = await generateScript(asset.personaPrompt, photoUrl, asset.openaiModel, excludedWords);
    await storage.updateJob(jobId, { scriptText });
    await storage.appendJobLog(jobId, `Script generated (${scriptText.split("\n").length} lines)`);

    if (!asset.voiceId) throw new Error("No voice selected for this asset setup");

    // ── Step 2: Parallel — voice generation + presigned URLs ────────────────
    await storage.updateJob(jobId, { status: "generating_audio" });
    await storage.appendJobLog(jobId, `Generating voice (ElevenLabs) + fetching R2 URLs in parallel...`);

    const [audioRawBuffer, videoUrl, musicUrl] = await Promise.all([
      generateVoice(scriptText, asset.voiceId, asset.elevenlabsModel, asset.useEnhance),
      getSignedDownloadUrl(asset.videoKey),
      asset.musicKey ? getSignedDownloadUrl(asset.musicKey) : Promise.resolve(null),
    ]);

    await storage.appendJobLog(jobId, `Voice ready (${(audioRawBuffer.length / 1024).toFixed(1)} KB). Starting FFmpeg + R2 upload in parallel...`);

    const voiceRawPath = join(workDir, "voice_raw.mp3");
    await writeFile(voiceRawPath, audioRawBuffer);

    const audioRawKey = `jobs/${jobId}/voice_raw.mp3`;

    // ── Step 3: Parallel — upload raw audio + run combined FFmpeg pass ───────
    await storage.updateJob(jobId, { status: "rendering" });
    await storage.appendJobLog(jobId, `Running combined FFmpeg pass (silenceremove + mix) + uploading raw audio in parallel...`);

    const finalPath = join(workDir, "final.mp4");

    await Promise.all([
      uploadToR2(audioRawKey, audioRawBuffer, "audio/mpeg"),
      combineAllInOne(voiceRawPath, videoUrl, musicUrl, finalPath, {
        thresholdDb: asset.thresholdDb,
        removeSilencesLongerThan: asset.removeSilencesLongerThan,
        ignoreDetectionsShorterThan: asset.ignoreDetectionsShorterThan,
        voiceVolume: asset.voiceVolume,
        musicVolume: asset.musicVolume,
      }),
    ]);

    await storage.updateJob(jobId, { audioRawKey });
    await storage.appendJobLog(jobId, "FFmpeg pass complete.");

    // ── Step 4: Auto-captions (optional) ────────────────────────────────────
    let outputPath = finalPath;
    if (asset.autoCaptions) {
      await storage.appendJobLog(jobId, "Generating captions via AI transcription...");
      try {
        const srtContent = await transcribeAudio(audioRawBuffer, workDir);
        await storage.appendJobLog(jobId, "Burning captions into video...");
        const captionedPath = join(workDir, "final_captioned.mp4");
        await burnCaptionsToFile(finalPath, srtContent, captionedPath, workDir);
        outputPath = captionedPath;
        await storage.appendJobLog(jobId, "Captions added successfully");
      } catch (err: any) {
        await storage.appendJobLog(jobId, `Warning: Caption generation failed: ${err.message}. Continuing without captions.`);
      }
    }

    // ── Step 5: Parallel AI text outputs ────────────────────────────────────
    const textTasks: Promise<void>[] = [];

    if (asset.hookHeadline) {
      textTasks.push((async () => {
        try {
          await storage.appendJobLog(jobId, "Generating hook headline...");
          const headline = await generateHookHeadline(asset.hookPrompt, photoUrl, asset.hookModel || asset.openaiModel);
          await storage.updateJob(jobId, { headlineText: headline });
          await storage.appendJobLog(jobId, `Hook headline: "${headline}"`);
        } catch (err: any) {
          await storage.appendJobLog(jobId, `Warning: Headline failed: ${err.message}`);
        }
      })());
    }

    if (asset.captionEnabled) {
      textTasks.push((async () => {
        try {
          await storage.appendJobLog(jobId, "Generating social media caption...");
          const caption = await generateCaption(asset.captionPrompt, photoUrl, asset.captionModel || asset.openaiModel);
          await storage.updateJob(jobId, { captionText: caption });
          await storage.appendJobLog(jobId, "Caption generated");
        } catch (err: any) {
          await storage.appendJobLog(jobId, `Warning: Caption failed: ${err.message}`);
        }
      })());
    }

    if (asset.seoEnabled) {
      textTasks.push((async () => {
        try {
          await storage.appendJobLog(jobId, "Generating SEO keywords & hashtags...");
          const seo = await generateSeoKeywords(asset.seoPrompt, photoUrl, asset.seoModel || asset.openaiModel);
          await storage.updateJob(jobId, { seoText: seo });
          await storage.appendJobLog(jobId, "SEO keywords generated");
        } catch (err: any) {
          await storage.appendJobLog(jobId, `Warning: SEO failed: ${err.message}`);
        }
      })());
    }

    if (textTasks.length > 0) {
      await storage.appendJobLog(jobId, `Running ${textTasks.length} AI text task(s) in parallel...`);
      await Promise.all(textTasks);
    }

    // ── Step 6: Upload final video ───────────────────────────────────────────
    await storage.appendJobLog(jobId, "Uploading final video to R2...");
    const finalBuffer = await readFile(outputPath);
    const finalVideoKey = `jobs/${jobId}/final.mp4`;
    await uploadToR2(finalVideoKey, finalBuffer, "video/mp4");
    await storage.updateJob(jobId, { finalVideoKey, status: "done" });
    await storage.appendJobLog(jobId, `Done! Final video uploaded (${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB).`);

  } catch (err: any) {
    console.error(`Job ${jobId} failed:`, err);
    await storage.updateJob(jobId, { status: "failed" });
    await storage.appendJobLog(jobId, `FAILED: ${err.message || String(err)}`);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const TERMINAL_STATUSES = ["queued", "done", "failed"];

async function recoverStuckJobs(): Promise<void> {
  try {
    const allJobs = await storage.getJobs();
    const stuck = allJobs.filter((j) => !TERMINAL_STATUSES.includes(j.status));
    if (stuck.length === 0) return;
    console.log(`[worker] Recovering ${stuck.length} stuck job(s)...`);
    for (const job of stuck) {
      await storage.updateJob(job.id, { status: "queued" });
      await storage.appendJobLog(job.id, "Job was interrupted — re-queued automatically on server restart.");
    }
  } catch (err) {
    console.error("[worker] Error recovering stuck jobs:", err);
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
      // Brief pause between jobs: lets GC free memory buffers from prior job
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (err) {
    console.error("Worker poll error:", err);
  } finally {
    workerRunning = false;
  }
}

export function startWorker() {
  console.log("[worker] Background worker started (polling every 3s)");
  recoverStuckJobs();
  setInterval(pollJobs, 3000);
}

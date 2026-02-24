# SmartDad Video Factory

## Overview
AI-powered video production pipeline for content creators. Users create "setups" (product photo + video + persona prompt + voice settings), then "activate" them to automatically generate scripts, voiceovers, and final videos through a background processing pipeline. Supports two video source modes: "Edited Video" (upload a pre-edited video) and "Video Builder" (auto-build videos from tagged shot clips using templates).

## Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (via Drizzle ORM)
- **Storage**: Cloudflare R2 (S3-compatible, private bucket)
- **AI**: OpenAI (via Replit AI Integrations) for script generation
- **TTS**: ElevenLabs API for voice generation
- **Media**: FFmpeg for dead-air removal, video/audio combining, and shot concatenation

### Project Structure
```
client/src/
  pages/home.tsx          - Main app page with tabs (Setup, Setups, Jobs, Builder)
  components/
    setup-form.tsx        - Create/edit setup form with Video Source selector
    setups-list.tsx       - List saved setups with activate/builder buttons
    jobs-list.tsx         - Jobs dashboard with status, downloads, sharing
    video-builder.tsx     - Shot library uploader, variant generation, rendering

server/
  index.ts               - Express server entry
  routes.ts              - API routes (assets, jobs, shots, variants)
  storage.ts             - Database CRUD operations
  db.ts                  - PostgreSQL connection
  r2.ts                  - Cloudflare R2 storage operations
  worker.ts              - Background job processing pipeline
  video-builder.ts       - FFmpeg variant rendering (concat shots)

shared/
  schema.ts              - Drizzle schema (assets, jobs, shots, variants tables)
```

### Database Tables
- **assets**: Setups with photo/video keys, persona, voice, model settings, volume levels, feature toggles, videoSource (edited|builder)
- **jobs**: Processing jobs linked to assets with status, outputs, sharing
- **shots**: Shot clips for Video Builder with category, shotType, duration, R2 key
- **variants**: Generated video variants with template, clip IDs, rendered R2 key

### Pipeline Flow
1. **Setup**: Upload photo + video (or choose Video Builder) + optional music to R2 (presigned URLs), save persona prompt + voice/model settings + volume levels + feature toggles to DB
2. **Video Builder** (optional): Upload tagged shot clips → generate variants using templates (45s/60s) → render via FFmpeg concat → send chosen variant to pipeline
3. **Activate**: Create job, queue for background processing
4. **Pipeline**:
   - Generate script via OpenAI with product photo (vision) + persona prompt (user-selectable model)
   - Generate voice via ElevenLabs TTS (user-selectable model + voice)
   - Cut dead air via FFmpeg silenceremove filter
   - Combine video + cleaned audio + optional background music via FFmpeg (adjustable volumes)
   - If auto-captions enabled: transcribe via OpenAI Whisper → burn SRT subtitles via FFmpeg
   - If hook headline enabled: generate headline text via OpenAI (with product photo vision) → save as copyable text
   - If caption enabled: generate social media caption via OpenAI (with product photo vision) → save as copyable text
   - If SEO enabled: generate hashtags & keywords via OpenAI (with product photo vision) → save as copyable text
   - Upload all outputs to R2
5. **Preview/Download/Share**: Video preview modal, signed URLs for private downloads, token-based sharing, copy buttons for headline/caption/SEO
6. **Edit**: Setups are editable (name, prompt, voice, models, dead-air settings, volumes, captions, hook headline)

### Video Builder Templates
- **45s**: Hook 3s → Problem 1.5s → Solution 1.5s → Highlight 3s → 6x Body 6s → CTA (optional)
- **60s**: Hook 3s → Problem 1.5s → Solution 1.5s → Highlight 3s → 8x Body 6s → CTA 3s
- Shot categories: HOOK, PROBLEM, SOLUTION, HIGHLIGHT, BODY, CTA
- Shot types (for BODY): demo, aesthetic, feature, top, side, pov, closeup, before_after
- Variant rules: no duplicate clips, avoid recently used (last 10 variants), ≥4 distinct BODY shotTypes

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` - Cloudflare R2
- `ELEVENLABS_API_KEY` - ElevenLabs TTS
- `SIGNED_URL_TTL_SECONDS` - Signed URL expiry (default 3600)
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI via Replit AI Integrations

## Recent Changes
- 2026-02-24: Converted hook headline from video overlay to text-only output with copy button. Added Social Media Caption generator and SEO Keywords/Hashtags generator — each with own toggle, prompt, model selector, and copy button in job results. Removed FFmpeg headline overlay and font styling options.
- 2026-02-24: Fixed hook headline timeout (600s + ultrafast preset for large videos), fixed download freeze (blob-based download with loading spinner instead of cross-origin a.click), added hookEffect selector (none/border/shadow/glow)
- 2026-02-24: Hook headline now overlays full video duration (not just 3s), script prompt targets 45s voiceover (80-100 words), hookModel selector added, jobs deletable regardless of status
- 2026-02-24: Fixed caption burning: installed libass/fontconfig/fonts, added FFmpeg timeout (180s captions, 120s hook), UTF-8 BOM for SRT, FontName=FreeSans
- 2026-02-24: Built CapCut-style video trimmer for Video Builder: thumbnail timeline strip, draggable start/end handles, region drag, playhead sync, preview clip playback
- 2026-02-24: Added Video Builder feature (shot library, variant generation, FFmpeg rendering, send-to-pipeline)
- 2026-02-24: Added video preview modal, background music upload with volume controls, auto captions (Whisper + FFmpeg subtitles), hook headline toggle with custom prompt and product photo vision (OpenAI + FFmpeg drawtext)
- 2026-02-23: Added ElevenLabs enhance (speaker boost) toggle, delete buttons for setups and jobs
- 2026-02-23: Added photo vision for script generation, model selectors (OpenAI + ElevenLabs), editable setups, split file uploads with progress bar
- 2026-02-23: Initial MVP build with full pipeline, setup management, job processing, and sharing

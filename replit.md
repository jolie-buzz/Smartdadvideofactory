# SmartDad Video Factory

## Overview
AI-powered video production pipeline for content creators. Users create "setups" (product photo + video + persona prompt + voice settings), then "activate" them to automatically generate scripts, voiceovers, and final videos through a background processing pipeline.

## Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (via Drizzle ORM)
- **Storage**: Cloudflare R2 (S3-compatible, private bucket)
- **AI**: OpenAI (via Replit AI Integrations) for script generation
- **TTS**: ElevenLabs API for voice generation
- **Media**: FFmpeg for dead-air removal and video/audio combining

### Project Structure
```
client/src/
  pages/home.tsx          - Main app page with tabs
  components/
    setup-form.tsx        - Create new setup form
    setups-list.tsx       - List saved setups with activate button
    jobs-list.tsx         - Jobs dashboard with status, downloads, sharing

server/
  index.ts               - Express server entry
  routes.ts              - API routes
  storage.ts             - Database CRUD operations
  db.ts                  - PostgreSQL connection
  r2.ts                  - Cloudflare R2 storage operations
  worker.ts              - Background job processing pipeline

shared/
  schema.ts              - Drizzle schema (assets, jobs tables)
```

### Pipeline Flow
1. **Setup**: Upload photo + video + optional music to R2 (separate requests to avoid 413), save persona prompt + voice/model settings + volume levels + feature toggles to DB
2. **Activate**: Create job, queue for background processing
3. **Pipeline**:
   - Generate script via OpenAI with product photo (vision) + persona prompt (user-selectable model)
   - Generate voice via ElevenLabs TTS (user-selectable model + voice)
   - Cut dead air via FFmpeg silenceremove filter
   - Combine video + cleaned audio + optional background music via FFmpeg (adjustable volumes)
   - If auto-captions enabled: transcribe via OpenAI Whisper → burn SRT subtitles via FFmpeg
   - If hook headline enabled: generate headline via OpenAI → overlay text via FFmpeg drawtext
   - Upload all outputs to R2
4. **Preview/Download/Share**: Video preview modal, signed URLs for private downloads, token-based sharing
5. **Edit**: Setups are editable (name, prompt, voice, models, dead-air settings, volumes, captions, hook headline)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` - Cloudflare R2
- `ELEVENLABS_API_KEY` - ElevenLabs TTS
- `SIGNED_URL_TTL_SECONDS` - Signed URL expiry (default 3600)
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI via Replit AI Integrations

## Recent Changes
- 2026-02-24: Added video preview modal, background music upload with volume controls, auto captions (Whisper + FFmpeg subtitles), hook headline toggle with custom prompt (OpenAI + FFmpeg drawtext)
- 2026-02-23: Added ElevenLabs enhance (speaker boost) toggle, delete buttons for setups and jobs
- 2026-02-23: Added photo vision for script generation, model selectors (OpenAI + ElevenLabs), editable setups, split file uploads with progress bar
- 2026-02-23: Initial MVP build with full pipeline, setup management, job processing, and sharing

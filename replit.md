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
  pages/
    home.tsx              - Main app page with tabs (Setup, Setups, Jobs)
    auth.tsx              - Login/register page
    admin.tsx             - Admin dashboard (user management)
  hooks/
    use-auth.ts           - Auth state hook (login, register, logout, current user)
  components/
    setup-form.tsx        - Create/edit setup form with Video Source selector, file replace
    setups-list.tsx       - List saved setups with activate/duplicate/edit/delete
    jobs-list.tsx         - Jobs dashboard with status, downloads, sharing
    video-builder.tsx     - Shot library uploader, variant generation, rendering
    video-trimmer.tsx     - CapCut-style shot clip trimming UI

server/
  index.ts               - Express server entry
  auth.ts                - Passport auth, session storage, login/register/logout routes
  routes.ts              - API routes (assets, jobs, shots, variants, admin)
  storage.ts             - Database CRUD operations (users, assets, jobs, shots, variants, script prompts)
  db.ts                  - PostgreSQL connection
  r2.ts                  - Cloudflare R2 storage operations
  worker.ts              - Background job processing pipeline
  video-builder.ts       - FFmpeg variant rendering (concat shots)

shared/
  schema.ts              - Drizzle schema (users, assets, jobs, shots, variants, script prompts)
```

### Database Tables
- **users**: User accounts with username, hashed password, role (admin|user), status (approved|pending|restricted), and global excluded words
- **assets**: Setups with photo/video keys, persona, voice, model settings, volume levels, feature toggles, videoSource (edited|builder), userId for ownership
- **jobs**: Processing jobs linked to assets with status, outputs, sharing, userId for ownership; audioCleanKey remains as a legacy nullable field
- **shots**: Shot clips for Video Builder with category, shotType, duration, R2 key
- **script_prompts**: Per-user saved prompt library entries for reuse in setup scripts
- **variants**: Generated video variants with template, clip IDs, rendered R2 key

### Authentication & Authorization
- Passport.js with local strategy, sessions stored in PostgreSQL via connect-pg-simple
- Default admin account seeded on first run (admin / admin123)
- New registrations require admin approval (status: pending)
- All API routes (except /api/auth/* and /s/:token share links) require authentication
- Per-user data isolation: each user only sees their own setups and jobs
- Admin dashboard: approve/restrict users, create accounts, edit usernames, reset passwords
- Users can change their own password via the header key icon
- Settings tab: excluded words and Script Prompt Library management

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
- `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` - Optional DeepSeek OpenAI-compatible endpoint for chat/script generation; used first when present
- `OPENAI_API_KEY` - Optional direct OpenAI key for chat/script generation and Whisper transcription; used when DeepSeek is not configured
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI via Replit AI Integrations; fallback for chat/script generation and Whisper transcription

## Recent Changes
- 2026-02-28: Speed up pipeline — removed local video download bottleneck; FFmpeg now streams video/music directly from R2 presigned URLs. Merged silenceremove + combine into ONE FFmpeg pass. Voice generation + presigned URL fetching run in parallel. Raw audio upload + FFmpeg run in parallel. hookHeadline/caption/SEO all generate in parallel. `burnCaptions` refactored to file-path based. `audioCleanKey` no longer uploaded (merged into final pass). Stuck job recovery on server restart. Jobs marked `processing` immediately on pickup. 2s breathing room between sequential queued jobs. Prompt library dropdown always visible (disabled placeholder when empty).
- 2026-02-26: Added Script Prompt Library — `script_prompts` table (userId, name, promptText); Settings tab has a new card to add/edit/delete named prompts; Setup form shows a "Load from prompt library" dropdown above the persona prompt textarea that pre-fills the field (stays independently editable). Routes: GET/POST/PATCH/DELETE `/api/script-prompts`.

- 2026-02-25: Added "Excluded Words" global setting per user — a Settings tab in the main UI where users enter words/phrases that must never appear in generated scripts. Stored in the `excluded_words` column on the `users` table, fetched at job runtime and injected into the OpenAI system prompt. Applies to all setups and future jobs automatically. Production migration runs via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on server startup.
- 2026-02-25: Added user authentication system with admin approval flow, per-user data isolation, admin dashboard (manage users, approve/restrict, create accounts, edit usernames, reset passwords), change password dialog, duplicate setup button, and photo/video file replacement in edit mode.
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

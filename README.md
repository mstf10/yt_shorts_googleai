# YT Shorts AI Generator

> **v0.0.10** · A web studio powered by Google Gemini and Pexels for generating viral YouTube Shorts scripts, voiceovers, and 9:16 portrait video previews.

## Overview

**YT Shorts AI Generator** is an end-to-end AI studio. You enter a single topic and it automatically produces a complete, exportable YouTube Short:

1. **Script generation** — Gemini writes a hook-driven, scene-by-scene storyboard (JSON) with per-scene stock search terms.
2. **Stock video fetch** — the Pexels API pulls matching HD portrait clips for every scene (with offline fallback clips when no key is set).
3. **Voiceover** — a multi-engine TTS pipeline (Gemini TTS → Edge TTS → Google GTX → tw-ob → browser Web Speech) creates a synthetic narrator.
4. **9:16 preview + export** — an interactive portrait player with synchronized karaoke subtitles, plus a full HD (720p/1080p) MP4/WebM render studio, JSON, and Markdown export.

## Features

- **Gemini Storyboard Generation** — automatic 4–6 scene scripts with hooks, narration, and stock video search terms, via a resilient fallback chain (`gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-2.5-flash`).
- **9:16 Live Shorts Preview Player** — mobile-styled player with synchronized karaoke word highlighting, stock video playback, mute, and scene navigation.
- **Pexels Video Engine** — fetches portrait HD stock footage per scene's visual query; falls back to a curated downloadable clip map when no key is present.
- **Interactive Storyboard Editor** — edit narration/visual queries, reassign voices & speech speed, reorder, add, or delete scenes, and refresh individual video clips.
- **AI Voiceover (multi-engine)** — Gemini TTS primary with automatic Edge TTS, Google Translate GTX, and tw-ob fallbacks; the browser's Web Speech API is the last-resort client fallback.
- **Full HD Render Studio** — background canvas rendering of the assembled 9:16 video (720p or 1080p, optional subtitles) using `captureStream` + `MediaRecorder`, exportable as MP4/WebM.
- **Model Status & Quota Tracking** — live RPM / TPM / RPD usage bars per model with real Google model metadata.
- **API Key Management** — Gemini & Pexels keys entered in the UI are validated and stored in `localStorage`, or set via environment variables.
- **Export Capabilities** — export the result as a rendered video, JSON schema, or Markdown, or copy CLI snippets.
- **Multilingual** — TR/EN built-in preset topics and language-aware TTS.
## Architecture

```
Frontend (React + Vite + Tailwind + Motion)
├── App                     # global state, page routing (studio | model-status)
├── Header                  # topic input, presets, API keys, key testing
├── StoryboardEditor        # scene editing, reorder, refresh clips
├── ShortsPlayer            # 9:16 preview, karaoke subtitles, voiceover
├── ModelStatusPage         # live model / quota dashboard
├── ExportModal             # video / JSON / Markdown export tabs
├── VideoExporter           # render settings + live preview canvas
└── lib/videoRenderer       # module-level singleton background render engine

Backend (Express + TSX)
├── API endpoints           # see table below
├── Gemini client           # text + TTS with fallback chains
├── Pexels client           # portrait stock video search
├── video-proxy             # same-origin proxy (CORS-safe canvas export)
└── TTS engines             # Gemini → Edge → GTX → tw-ob
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-script` | POST | Generate scene-based storyboard (Gemini fallback chain) |
| `/api/fetch-pexels-video` | POST | Search Pexels portrait stock video (falls back to local clip map) |
| `/api/test-keys` | POST | Validate Gemini & Pexels API keys |
| `/api/model-status` | POST | Test models, fetch quotas & remaining usage (RPM/TPM/RPD) |
| `/api/status` | GET | Server status |
| `/api/video-proxy` | GET | Same-origin proxy with `Range` + CORS headers for export canvas |
| `/api/tts` | GET | Multi-engine voiceover audio (`?text=&lang=&apiKey=`) |

## AI Models

| Role | Models (priority order) |
|------|-------------------------|
| Text / script generation | `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-2.5-flash` |
| TTS (primary) | `gemini-3.1-flash-tts-preview` → `gemini-2.5-pro-preview-tts` |
| TTS (fallback) | Edge TTS → Google Translate GTX → tw-ob → browser Web Speech |
| Stock video | Pexels HD portrait API |

## Development

```bash
# Install dependencies
npm install

# Copy the environment template and add your keys (optional; keys can also be
# entered & saved in the UI)
cp .env.example .env

# Start the dev server (Express + Vite middleware) on http://localhost:3000
npm run dev
```

## Build & Production

```bash
# Build the frontend bundle and the server (dist/)
npm run build

# Run the production server (serves dist/ statically)
npm start
```

> The production server expects `NODE_ENV=production` and a built `dist/` folder. When `NODE_ENV` is not `production`, Express mounts the Vite dev middleware automatically.
## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No (fallback to UI/localStorage) | Google AI Studio / Gemini API key |
| `PEXELS_API_KEY` | No (enables real stock search) | Pexels API key |

Keys entered in the app UI are persisted in `localStorage` (`yt_shorts_gemini_key`, `yt_shorts_pexels_key`) and take precedence for requests from that browser.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx server.ts` | Start dev server with Vite hot reload |
| `build` | `vite build && esbuild server.ts ...` | Bundle frontend + server to `dist/` |
| `start` | `tsx server.ts` | Run production server |

## Tech Stack

- **Frontend:** React 18.3, Vite 5.4, Tailwind CSS 4, Motion 12, Lucide React, TypeScript 5.6
- **Backend:** Express 4.21, TSX 4.19 (runner), esbuild 0.24 (bundler)
- **AI / Media:** `@google/genai`, `edge-tts-node` 1.5, Pexels API
- **Runtime:** Node.js 22 (designed for AI Studio Cloud Run)

## Version History

- **0.0.10** — Responsive natural-scroll homepage layout, mobile layout & overflow fixes for API keys panel.
- **0.0.9** — Multi-engine TTS (Gemini → Edge → GTX → tw-ob), background render engine, model status & quota dashboard, video proxy, storyboard editor, export studio.
- **0.0.8** — Scene reordering, video clip refresh, quota progress-bar safety fixes.
- **0.0.7** — Storyboard editor enhancements, model info & export data improvements.
- **0.0.6** — Video export pre-loading optimizations.
- **0.0.5** — Replaced ElevenLabs with Edge TTS; added `apiKey` support in Pexels fetch.

## Roadmap

- [ ] Background music
- [ ] Scene transition effects
- [ ] Batch mode
- [ ] YouTube upload
- [ ] Veo 2 integration
- [ ] Firebase Auth

## License

**MIT License** · Developer: @mstf10 · Repo: [github.com/mstf10/yt_shorts_googleai](https://github.com/mstf10/yt_shorts_googleai)


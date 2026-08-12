/**
 * Background video renderer (module-level singleton).
 *
 * The MP4/WebM render engine lives OUTSIDE of any React component so it keeps
 * running even if the ExportModal is closed or the user navigates around the
 * app. Components (VideoExporter, App) subscribe to its state and react to
 * progress / completion.
 */
import { Scene } from '../types';

export interface VideoRenderConfig {
  topic: string;
  scenes: Scene[];
  selectedVoice: string;
  speechRate: number;
  language: string;
  includeSubtitles: boolean;
  videoQuality: '720p' | '1080p';
}

export type VideoRenderStatus = 'idle' | 'rendering' | 'done' | 'error';

export interface VideoRenderState {
  status: VideoRenderStatus;
  progress: number;
  currentScene: number;
  statusText: string;
  resultUrl: string | null;
  error: string | null;
  videoQuality: '720p' | '1080p';
}

/**
 * Draw a video element into a canvas using "object-fit: cover" semantics.
 * Prevents distortion when compositing landscape stock clips into the 9:16 portrait canvas.
 */
function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cw: number,
  ch: number
) {
  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  if (vw === 0 || vh === 0) return;
  const scale = Math.max(cw / vw, ch / vh);
  const sw = cw / scale;
  const sh = ch / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
}

/**
 * Route a remote stock-video URL through our same-origin proxy so the browser can
 * draw it into the export canvas without CORS restrictions (avoiding the tainted
 * canvas that previously produced a black background in the exported video).
 */
function buildProxiedVideoUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) {
    return `/api/video-proxy?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

// ---------------------------------------------------------------------------
// Global state (module-level singleton). On every update we replace the state
// object with a fresh reference so useSyncExternalStore re-renders listeners.
// ---------------------------------------------------------------------------

let state: VideoRenderState = {
  status: 'idle',
  progress: 0,
  currentScene: 0,
  statusText: '',
  resultUrl: null,
  error: null,
  videoQuality: '720p',
};

const listeners = new Set<() => void>();

function update(patch: Partial<VideoRenderState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeVideoRender(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVideoRenderState(): VideoRenderState {
  return state;
}

// The live preview canvas owned by the engine (created at render start).
let engineCanvas: HTMLCanvasElement | null = null;

export function getEngineCanvas(): HTMLCanvasElement | null {
  return engineCanvas;
}

// Cancellation flag for the currently running render. Only one render runs at a
// time (enforced by the status guard in startRender).
let cancelRequested = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isVideoRenderActive(): boolean {
  return state.status === 'rendering';
}

export function startRender(config: VideoRenderConfig): void {
  if (state.status === 'rendering') return;
  if (config.scenes.length === 0) {
    update({ status: 'error', error: 'Render için önce sahne oluşturulmalı.' });
    return;
  }
  cancelRequested = false;
  // Fire-and-forget; the heavy work continues in the background.
  void runRender(config);
}

export function cancelRender(): void {
  cancelRequested = true;
}

// ---------------------------------------------------------------------------
// Render engine
// ---------------------------------------------------------------------------

async function runRender(config: VideoRenderConfig) {
  const { topic, scenes, selectedVoice, speechRate, language, includeSubtitles, videoQuality } = config;

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Release the previous result blob before starting a new render.
  if (state.resultUrl) {
    try {
      URL.revokeObjectURL(state.resultUrl);
    } catch (_) {}
  }

  update({
    status: 'rendering',
    progress: 0,
    currentScene: 0,
    statusText: 'Tuval Hazırlanıyor...',
    resultUrl: null,
    error: null,
    videoQuality,
  });

  const width = videoQuality === '1080p' ? 1080 : 720;
  const height = videoQuality === '1080p' ? 1920 : 1280;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  engineCanvas = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    update({ status: 'error', error: 'Canvas context bu tarayıcıda desteklenmiyor.' });
    return;
  }

  // Initialize the Web Audio API to record the voiceover audio stream.
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (_) {}
  }
  const audioDest = audioCtx.createMediaStreamDestination();

  // Combined canvas video + Web Audio destination audio stream.
  const canvasStream = canvas.captureStream(30);
  const videoTrack = canvasStream.getVideoTracks()[0];
  const audioTrack = audioDest.stream.getAudioTracks()[0];

  const combinedStream = new MediaStream([
    videoTrack,
    ...(audioTrack ? [audioTrack] : []),
  ]);

  const isTurkish =
    language === 'tr' ||
    /[çğışöüÇĞİŞÖÜ]/i.test(topic) ||
    /[çğışöüÇĞİŞÖÜ]/i.test(scenes[0]?.text || '');
  const savedGeminiKey = localStorage.getItem('yt_shorts_gemini_key') || '';

  // STEP 1: Pre-fetch and decode TTS audio for ALL scenes before recording starts.
  update({ statusText: 'Seslendirme ses dosyaları indiriliyor...' });
  const sceneAudioBuffers: (AudioBuffer | null)[] = await Promise.all(
    scenes.map(async (scene) => {
      const text = scene.text || '';
      if (!text) return null;
      try {
        const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${
          isTurkish ? 'tr' : language
        }${savedGeminiKey ? `&apiKey=${encodeURIComponent(savedGeminiKey)}` : ''}`;
        const res = await fetch(ttsUrl);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          return await audioCtx.decodeAudioData(buf);
        }
      } catch (e) {
        console.warn('TTS preload error for scene:', e);
      }
      return null;
    })
  );

  if (cancelRequested) {
    try {
      await audioCtx.close();
    } catch (_) {}
    update({ status: 'idle', progress: 0, currentScene: 0, statusText: 'Render iptal edildi.' });
    return;
  }


  // STEP 2: Pre-load stock video elements for ALL scenes.
  update({ statusText: 'Stok video arka planları yükleniyor...' });
  const loadedVideos: (HTMLVideoElement | null)[] = await Promise.all(
    scenes.map((s) => {
      return new Promise<HTMLVideoElement | null>((resolve) => {
        if (!s.video_url) return resolve(null);
        const v = document.createElement('video');
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        // Same-origin proxy => the canvas never becomes tainted (fixes black/empty frames).
        v.crossOrigin = 'anonymous';

        let finished = false;
        const finish = (result: HTMLVideoElement | null) => {
          if (!finished) {
            finished = true;
            resolve(result);
          }
        };

        v.onloadeddata = () => finish(v);
        v.oncanplay = () => finish(v);
        v.onerror = () => finish(null);

        // Safety timeout 5s per video.
        setTimeout(() => finish(v.readyState >= 1 ? v : null), 5000);

        v.src = buildProxiedVideoUrl(s.video_url);
        v.load();
      });
    })
  );

  if (cancelRequested) {
    try {
      await audioCtx.close();
    } catch (_) {}
    update({ status: 'idle', progress: 0, currentScene: 0, statusText: 'Render iptal edildi.' });
    return;
  }

  // STEP 3: Start MediaRecorder ONLY NOW after all assets are loaded and ready.
  let mediaRecorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];

  const supportedTypes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const selectedMime =
    supportedTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

  try {
    mediaRecorder = new MediaRecorder(
      combinedStream,
      selectedMime ? { mimeType: selectedMime } : undefined
    );
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
  } catch (e) {
    console.warn('MediaRecorder error, falling back to default options:', e);
    mediaRecorder = new MediaRecorder(combinedStream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
  }

// STEP 4: Render loop scene by scene.
  for (let i = 0; i < scenes.length; i++) {
    if (cancelRequested) break;

    update({ currentScene: i + 1 });
    const scene = scenes[i];
    const sceneVideo = loadedVideos[i];
    const audioBuffer = sceneAudioBuffers[i];
    const currentText = (scene.text || '').trim();

    if (sceneVideo) {
      try {
        sceneVideo.currentTime = 0;
        sceneVideo.play().catch(() => {});
      } catch (_) {}
    }

    update({ statusText: `Sahne ${i + 1} / ${scenes.length} render ediliyor (Ses & Görsel)...` });

    let sourceNode: AudioBufferSourceNode | null = null;
    let effectiveAudioDurationMs = 0;

    if (audioBuffer) {
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      const speed = Math.max(0.5, Math.min(2.0, speechRate || 1.0));
      sourceNode.playbackRate.value = speed;
      // Route strictly into the recording destination (no live speaker audio).
      sourceNode.connect(audioDest);

      effectiveAudioDurationMs = (audioBuffer.duration * 1000) / speed;
      sourceNode.start(0);
    }

    // Exact scene duration (effective audio duration + 350ms padding).
    const sceneDurationMs = audioBuffer
      ? effectiveAudioDurationMs + 350
      : Math.max(3500, currentText.length * 80);

    const sceneStartTime = Date.now();
    const rawWords = currentText ? currentText.split(/\s+/) : [];
    let totalWordChars = 0;
    const wordCharCounts = rawWords.map((w) => {
      const len = w.length;
      totalWordChars += len;
      return len;
    });

    // Frame animation loop.
    while (Date.now() - sceneStartTime < sceneDurationMs) {
      if (cancelRequested) break;

      ctx.clearRect(0, 0, width, height);

      const elapsedMs = Date.now() - sceneStartTime;
      const audioProgressRatio =
        effectiveAudioDurationMs > 0
          ? Math.min(1, elapsedMs / effectiveAudioDurationMs)
          : Math.min(1, elapsedMs / sceneDurationMs);

      // Calculate active word index dynamically based on character length weights.
      let activeWordIndex = -1;
      if (rawWords.length > 0 && audioProgressRatio >= 0) {
        if (audioProgressRatio >= 1.0) {
          activeWordIndex = rawWords.length - 1;
        } else {
          const targetCharPos = audioProgressRatio * totalWordChars;
          let accumulated = 0;
          for (let wIdx = 0; wIdx < rawWords.length; wIdx++) {
            accumulated += wordCharCounts[wIdx];
            if (targetCharPos <= accumulated || wIdx === rawWords.length - 1) {
              activeWordIndex = wIdx;
              break;
            }
          }
        }
      }

      // 1. Draw video background or fallback gradient.
      if (sceneVideo && sceneVideo.readyState >= 2) {
        drawVideoCover(ctx, sceneVideo, width, height);
      } else {
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#0f172a');
        bgGradient.addColorStop(0.5, '#1e1b4b');
        bgGradient.addColorStop(1, '#020617');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw Vignette Gradient Overlays.
      const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.2);
      topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      topGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, height * 0.2);

      const bottomGrad = ctx.createLinearGradient(0, height * 0.6, 0, height);
      bottomGrad.addColorStop(0, 'transparent');
      bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, height * 0.6, width, height * 0.4);

      // 3. Header Branding Text.
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'left';
      ctx.fillText('🔴 YT SHORTS AI', 40, 60);

      // 4. Draw Karaoke Subtitles (5 Words Chunk).
      if (includeSubtitles && currentText && rawWords.length > 0) {
        const CHUNK_SIZE = 5;
        const currentChunkIndex =
          activeWordIndex >= 0 ? Math.floor(activeWordIndex / CHUNK_SIZE) : 0;
        const chunkStart = currentChunkIndex * CHUNK_SIZE;
        const chunkEnd = Math.min(rawWords.length, chunkStart + CHUNK_SIZE);
        const visibleWords = rawWords.slice(chunkStart, chunkEnd);

        const fontSize = Math.round(width * 0.046);
        ctx.font = `900 ${fontSize}px sans-serif, system-ui`;
        ctx.textAlign = 'left';

        const spaceWidth = ctx.measureText(' ').width;
        const maxLineWidth = width - 120;

        interface RenderWord {
          text: string;
          originalIndex: number;
          width: number;
        }
        interface TextLine {
          words: RenderWord[];
          totalWidth: number;
        }

        const lines: TextLine[] = [];
        let currentLineWords: RenderWord[] = [];
        let currentLineWidth = 0;

        visibleWords.forEach((wText, relIndex) => {
          const originalIndex = chunkStart + relIndex;
          const formattedWord = isTurkish
            ? wText.toLocaleUpperCase('tr-TR')
            : wText.toLocaleUpperCase('en-US');

          const wordWidth = ctx.measureText(formattedWord).width;

          if (
            currentLineWords.length > 0 &&
            currentLineWidth + spaceWidth + wordWidth > maxLineWidth
          ) {
            lines.push({
              words: currentLineWords,
              totalWidth: currentLineWidth,
            });
            currentLineWords = [];
            currentLineWidth = 0;
          }

          currentLineWords.push({
            text: formattedWord,
            originalIndex,
            width: wordWidth,
          });
          currentLineWidth += (currentLineWords.length > 1 ? spaceWidth : 0) + wordWidth;
        });

        if (currentLineWords.length > 0) {
          lines.push({
            words: currentLineWords,
            totalWidth: currentLineWidth,
          });
        }

        const lineHeight = fontSize * 1.45;
        const boxPaddingY = Math.round(fontSize * 0.6);
        const boxHeight = lines.length * lineHeight + boxPaddingY * 2;
        const boxY = height - 160 - boxHeight;

        ctx.save();

        // Background banner.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.roundRect(40, boxY, width - 80, boxHeight, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Render words.
        lines.forEach((line, lineIdx) => {
          const lineY = boxY + boxPaddingY + (lineIdx + 0.72) * lineHeight;
          let startX = (width - line.totalWidth) / 2;

          line.words.forEach((wordObj) => {
            const isHighlight = wordObj.originalIndex === activeWordIndex;

            if (isHighlight) {
              const pillPadX = Math.round(fontSize * 0.25);
              const pillPadY = Math.round(fontSize * 0.12);
              ctx.fillStyle = '#fbbf24'; // amber-400
              ctx.beginPath();
              ctx.roundRect(
                startX - pillPadX,
                lineY - fontSize + pillPadY,
                wordObj.width + pillPadX * 2,
                fontSize + pillPadY,
                8
              );
              ctx.fill();

              ctx.fillStyle = '#000000';
              ctx.fillText(wordObj.text, startX, lineY);
            } else {
              ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
              ctx.shadowBlur = 4;
              ctx.fillStyle = '#ffffff';
              ctx.fillText(wordObj.text, startX, lineY);
              ctx.shadowBlur = 0;
            }

            startX += wordObj.width + spaceWidth;
          });
        });

        ctx.restore();
      }

      // Progress update.
      const elapsedScenePct = Math.min(1, elapsedMs / sceneDurationMs);
      const overallPct = Math.round(((i + elapsedScenePct) / scenes.length) * 100);
      update({ progress: overallPct });

      await new Promise((r) => setTimeout(r, 33)); // ~30 FPS
    }

    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch (_) {}
    }
    if (sceneVideo) {
      try {
        sceneVideo.pause();
      } catch (_) {}
    }
  }

  update({ statusText: 'Video dosyası oluşturuluyor...' });
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  if (cancelRequested) {
    // Discard the partial recording and go back to idle.
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (_) {}
    }
    try {
      await audioCtx.close();
    } catch (_) {}
    update({ status: 'idle', progress: 0, currentScene: 0, statusText: 'Render iptal edildi.' });
    return;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    await new Promise((r) => setTimeout(r, 500));
  }

  const videoBlob = new Blob(chunks, { type: selectedMime || 'video/mp4' });
  const generatedUrl = URL.createObjectURL(videoBlob);

  try {
    await audioCtx.close();
  } catch (_) {}

  update({
    status: 'done',
    progress: 100,
    resultUrl: generatedUrl,
    statusText: 'Video Render Tamamlandı!',
  });
}


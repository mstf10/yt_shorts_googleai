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
 * Fallback background gradient when no video clip is available or ready.
 */
function drawFallbackGradient(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, '#0f172a');
  bgGradient.addColorStop(0.5, '#1e1b4b');
  bgGradient.addColorStop(1, '#020617');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Route a remote stock-video URL through our same-origin proxy so the browser can
 * draw it into the export canvas without CORS restrictions (avoiding the tainted
 * canvas that previously produced a black background in the exported video).
 */
function buildProxiedVideoUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('/api/video-proxy')) return rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) {
    return `/api/video-proxy?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

// Global AudioContext singleton to ensure initialization within user-gesture stack
let sharedAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
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
  // Initialize or resume AudioContext synchronously inside user click event stack
  getOrCreateAudioContext();
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

  // Draw initial canvas frame to establish canvasStream timeline
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  const isTurkish =
    language === 'tr' ||
    /[çğışöüÇĞİŞÖÜ]/i.test(topic) ||
    /[çğışöüÇĞİŞÖÜ]/i.test(scenes[0]?.text || '');
  const savedGeminiKey = localStorage.getItem('yt_shorts_gemini_key') || '';

  // Ensure AudioContext is active and ready
  const audioCtx = getOrCreateAudioContext();
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (_) {}
  }

  // STEP 1: Pre-fetch TTS audio ArrayBuffers for ALL scenes before recording starts.
  update({ statusText: 'Seslendirme ses dosyaları indiriliyor...' });
  const sceneAudioArrayBuffers: (ArrayBuffer | null)[] = await Promise.all(
    scenes.map(async (scene) => {
      const text = scene.text || '';
      if (!text) return null;
      try {
        const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${
          isTurkish ? 'tr' : language
        }${savedGeminiKey ? `&apiKey=${encodeURIComponent(savedGeminiKey)}` : ''}`;
        const res = await fetch(ttsUrl);
        if (res.ok) {
          return await res.arrayBuffer();
        }
      } catch (e) {
        console.warn('TTS preload error for scene:', e);
      }
      return null;
    })
  );

  if (cancelRequested) {
    update({ status: 'idle', progress: 0, currentScene: 0, statusText: 'Render iptal edildi.' });
    return;
  }

  // Hidden container with valid layout dimensions so browser hardware video decoder does not throttle frame decoding
  const hiddenContainer = document.createElement('div');
  hiddenContainer.style.position = 'fixed';
  hiddenContainer.style.top = '0';
  hiddenContainer.style.left = '0';
  hiddenContainer.style.width = '640px';
  hiddenContainer.style.height = '360px';
  hiddenContainer.style.zIndex = '-9999';
  hiddenContainer.style.opacity = '0.01';
  hiddenContainer.style.pointerEvents = 'none';
  hiddenContainer.style.overflow = 'hidden';
  document.body.appendChild(hiddenContainer);

  // STEP 2: Pre-load stock video elements for ALL scenes.
  update({ statusText: 'Stok video arka planları yükleniyor...' });
  const loadedVideos: (HTMLVideoElement | null)[] = await Promise.all(
    scenes.map((s) => {
      return new Promise<HTMLVideoElement | null>((resolve) => {
        if (!s.video_url) {
          console.log(`Scene ${s.scene}: No video URL, skipping preloading`);
          return resolve(null);
        }
        console.log(`Scene ${s.scene}: Attempting to preload Pexels video: ${s.video_url}`);
        const v = document.createElement('video');
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = 'auto';
        // Same-origin proxy => the canvas never becomes tainted (fixes black/empty frames).
        v.crossOrigin = 'anonymous';
        hiddenContainer.appendChild(v);

        let finished = false;
        const finish = (result: HTMLVideoElement | null) => {
          if (!finished) {
            finished = true;
            if (result) {
              console.log(`Scene ${s.scene}: Video preloaded successfully, duration: ${result.duration}s`);
            } else {
              console.warn(`Scene ${s.scene}: Video preloading failed or timed out`);
            }
            resolve(result);
          }
        };

        v.onloadeddata = () => finish(v);
        v.oncanplay = () => finish(v);
        v.onerror = (e) => {
          console.warn(`Scene ${s.scene}: Video load error for URL: ${s.video_url}`, e);
          finish(null);
        };

        // Safety timeout 6s per video.
        setTimeout(() => {
          finish(v.readyState >= 1 ? v : null);
        }, 6000);

        const proxiedUrl = buildProxiedVideoUrl(s.video_url);
        v.src = proxiedUrl;
        v.load();
      });
    })
  );

  if (cancelRequested) {
    try {
      hiddenContainer.remove();
    } catch (_) {}
    update({ status: 'idle', progress: 0, currentScene: 0, statusText: 'Render iptal edildi.' });
    return;
  }

  // STEP 3: Setup Web Audio API destination and MediaRecorder
  update({ statusText: 'Ses bileşenleri ve kayıt başlatılıyor...' });
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (_) {}
  }

  const audioDest = audioCtx.createMediaStreamDestination();

  const sceneAudioBuffers: (AudioBuffer | null)[] = await Promise.all(
    sceneAudioArrayBuffers.map(async (buf) => {
      if (!buf) return null;
      try {
        return await audioCtx.decodeAudioData(buf.slice(0));
      } catch (e) {
        console.warn('Audio decode error:', e);
        return null;
      }
    })
  );

  const canvasStream = canvas.captureStream(30);
  const videoTrack = canvasStream.getVideoTracks()[0];
  const audioTrack = audioDest.stream.getAudioTracks()[0];

  const combinedStream = new MediaStream([
    videoTrack,
    ...(audioTrack ? [audioTrack] : []),
  ]);

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
    mediaRecorder.start(100);
  } catch (e) {
    console.warn('MediaRecorder error, falling back to default options:', e);
    mediaRecorder = new MediaRecorder(combinedStream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start(100);
  }

  // STEP 4: Render loop scene by scene.
  for (let i = 0; i < scenes.length; i++) {
    if (cancelRequested) break;

    update({ currentScene: i + 1 });
    const scene = scenes[i];
    const sceneVideo = loadedVideos[i];
    const audioBuffer = sceneAudioBuffers[i];
    const currentText = (scene.text || '').trim();

    // Ensure video element playback is started and frames are decoding before starting scene loop
    if (sceneVideo) {
      try {
        sceneVideo.currentTime = 0;
        const playPromise = sceneVideo.play();
        if (playPromise !== undefined) {
          await playPromise.catch(() => {});
        }
      } catch (_) {}

      const startWait = Date.now();
      while (sceneVideo.readyState < 2 && Date.now() - startWait < 1500) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    update({ statusText: `Sahne ${i + 1} / ${scenes.length} render ediliyor (Ses & Görsel)...` });

    let sourceNode: AudioBufferSourceNode | null = null;
    let effectiveAudioDurationMs = 0;

    if (audioBuffer) {
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      const speed = Math.max(0.5, Math.min(2.0, speechRate || 1.0));
      sourceNode.playbackRate.value = speed;
      sourceNode.connect(audioDest);

      effectiveAudioDurationMs = (audioBuffer.duration * 1000) / speed;
      // Start audio buffer precisely at the current audioCtx timeline position
      sourceNode.start(audioCtx.currentTime);
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

      // 1. Draw video background or fallback gradient safely.
      if (sceneVideo && sceneVideo.readyState >= 2) {
        try {
          drawVideoCover(ctx, sceneVideo, width, height);
        } catch (e) {
          drawFallbackGradient(ctx, width, height);
        }
      } else {
        drawFallbackGradient(ctx, width, height);
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

  // Cleanup
  if (hiddenContainer) {
    try {
      hiddenContainer.remove();
    } catch (_) {}
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
    update({ status: 'idle', progress: 0, currentScene: 0, statusText: 'Render iptal edildi.' });
    return;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    await new Promise((r) => setTimeout(r, 500));
  }

  const videoBlob = new Blob(chunks, { type: selectedMime || 'video/mp4' });
  const generatedUrl = URL.createObjectURL(videoBlob);

  update({
    status: 'done',
    progress: 100,
    resultUrl: generatedUrl,
    statusText: 'Video Render Tamamlandı!',
  });
}



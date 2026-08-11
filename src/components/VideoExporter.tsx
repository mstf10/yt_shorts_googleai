import React, { useState, useRef, useEffect } from 'react';
import { Scene } from '../types';
import { Video, Download, RefreshCw, CheckCircle, Play, Film, Sparkles, Layers, Sliders } from 'lucide-react';

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

interface VideoExporterProps {
  topic: string;
  scenes: Scene[];
  selectedVoice: string;
  speechRate: number;
  language: string;
}

export const VideoExporter: React.FC<VideoExporterProps> = ({
  topic,
  scenes,
  selectedVoice,
  speechRate,
  language,
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRenderingScene, setCurrentRenderingScene] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'720p' | '1080p'>('720p');
  const [renderStatusText, setRenderStatusText] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Revoke the rendered video's blob URL when the component unmounts to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (renderedVideoUrl) URL.revokeObjectURL(renderedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderedVideoUrl]);

  const startVideoRender = async () => {
    if (scenes.length === 0 || isRendering) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Release the previous rendered video's blob URL before starting a new render,
    // otherwise repeated re-renders leak memory (each blob stays alive until page reload).
    setRenderedVideoUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      return null;
    });

    setIsRendering(true);
    setProgress(0);
    setRenderStatusText('Tuval Hazırlanıyor...');

    const width = videoQuality === '1080p' ? 1080 : 720;
    const height = videoQuality === '1080p' ? 1920 : 1280;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      alert('Canvas context not supported in this browser.');
      setIsRendering(false);
      return;
    }

    // Initialize Web Audio API to record voiceover audio stream
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const audioDest = audioCtx.createMediaStreamDestination();

    // Prepare combined canvas video + Web Audio destination audio stream
    const canvasStream = canvas.captureStream(30);
    const videoTrack = canvasStream.getVideoTracks()[0];
    const audioTrack = audioDest.stream.getAudioTracks()[0];

    const combinedStream = new MediaStream([
      videoTrack,
      ...(audioTrack ? [audioTrack] : []),
    ]);

    const isTurkish = language === 'tr' || /[çğışöüÇĞİŞÖÜ]/i.test(topic) || /[çğışöüÇĞİŞÖÜ]/i.test(scenes[0]?.text || '');
    const savedGeminiKey = localStorage.getItem('yt_shorts_gemini_key') || '';

    // STEP 1: Pre-fetch and decode TTS audio for ALL scenes before recording starts
    setRenderStatusText('Seslendirme ses dosyaları indiriliyor...');
    const sceneAudioBuffers: (AudioBuffer | null)[] = await Promise.all(
      scenes.map(async (scene) => {
        const text = scene.text || '';
        if (!text) return null;
        try {
          const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${isTurkish ? 'tr' : language}${savedGeminiKey ? `&apiKey=${encodeURIComponent(savedGeminiKey)}` : ''}`;
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

    // STEP 2: Pre-load stock video elements for ALL scenes
    setRenderStatusText('Stok video arka planları yükleniyor...');
    const loadedVideos: (HTMLVideoElement | null)[] = await Promise.all(
      scenes.map((s) => {
        return new Promise<HTMLVideoElement | null>((resolve) => {
          if (!s.video_url) return resolve(null);
          const v = document.createElement('video');
          v.muted = true;
          v.loop = true;
          v.playsInline = true;
          // CRITICAL: Without `crossorigin` the video is fetched in no-cors mode,
          // the canvas becomes tainted when drawn, and the exported recording
          // loses the Pexels background (black/empty frames).
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

          // Safety timeout 5s per video
          setTimeout(() => finish(v.readyState >= 1 ? v : null), 5000);

          v.src = s.video_url;
          v.load();
        });
      })
    );

    // STEP 3: Start MediaRecorder ONLY NOW after all assets are loaded and ready
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
    let selectedMime = supportedTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

    try {
      mediaRecorder = new MediaRecorder(combinedStream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    } catch (e) {
      console.warn('MediaRecorder error, falling back to default stream options:', e);
      mediaRecorder = new MediaRecorder(combinedStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    }

    // STEP 4: Render loop scene by scene
    for (let i = 0; i < scenes.length; i++) {
      setCurrentRenderingScene(i + 1);
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

      setRenderStatusText(`Sahne ${i + 1} / ${scenes.length} render ediliyor (Ses & Görsel)...`);

      let sourceNode: AudioBufferSourceNode | null = null;
      let effectiveAudioDurationMs = 0;

      if (audioBuffer) {
        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        const speed = Math.max(0.5, Math.min(2.0, speechRate || 1.0));
        sourceNode.playbackRate.value = speed;
        // Route strictly into recording destination (no live speaker audio during render)
        sourceNode.connect(audioDest);

        effectiveAudioDurationMs = (audioBuffer.duration * 1000) / speed;
        sourceNode.start(0);
      }

      // Exact scene duration (effective audio duration + 350ms padding)
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

      // Frame animation loop
      while (Date.now() - sceneStartTime < sceneDurationMs) {
        ctx.clearRect(0, 0, width, height);

        const elapsedMs = Date.now() - sceneStartTime;
        const audioProgressRatio = effectiveAudioDurationMs > 0
          ? Math.min(1, elapsedMs / effectiveAudioDurationMs)
          : Math.min(1, elapsedMs / sceneDurationMs);

        // Calculate active word index dynamically based on character length weights
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

        // 1. Draw video background or fallback gradient
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

        // 2. Draw Vignette Gradient Overlays
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

        // 3. Header Branding Text
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'left';
        ctx.fillText('🔴 YT SHORTS AI', 40, 60);

        // 4. Draw Karaoke Subtitles (5 Words Chunk)
        if (includeSubtitles && currentText && rawWords.length > 0) {
          const CHUNK_SIZE = 5;
          const currentChunkIndex = activeWordIndex >= 0 ? Math.floor(activeWordIndex / CHUNK_SIZE) : 0;
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

          // Background banner
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.beginPath();
          ctx.roundRect(40, boxY, width - 80, boxHeight, 20);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Render words
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

        // Progress update
        const elapsedScenePct = Math.min(1, elapsedMs / sceneDurationMs);
        const overallPct = Math.round(((i + elapsedScenePct) / scenes.length) * 100);
        setProgress(overallPct);

        await new Promise((r) => setTimeout(r, 33)); // ~30 FPS
      }

      if (sourceNode) {
        try { sourceNode.stop(); } catch (_) {}
      }
      if (sceneVideo) {
        try { sceneVideo.pause(); } catch (_) {}
      }
    }

    setRenderStatusText('Video dosyası oluşturuluyor...');
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      await new Promise((r) => setTimeout(r, 500));
    }

    const videoBlob = new Blob(chunks, { type: selectedMime || 'video/mp4' });
    const generatedUrl = URL.createObjectURL(videoBlob);

    setRenderedVideoUrl(generatedUrl);
    setIsRendering(false);
    setProgress(100);
    setRenderStatusText('Video Render Tamamlandı!');
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Film className="w-5 h-5 text-red-500" />
          <h4 className="font-bold text-slate-100 text-sm">9:16 Shorts Full HD Render Stüdyosu</h4>
        </div>

        <span className="text-[10px] bg-red-500/10 text-red-400 font-bold px-2.5 py-1 rounded-lg border border-red-500/20 uppercase tracking-wider">
          Studio Canvas Engine
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls & Status Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Video Kalitesi & Çözünürlük:</label>
              <select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as any)}
                disabled={isRendering}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-red-500"
              >
                <option value="720p">720x1280 Dikey Short (Hızlı HD)</option>
                <option value="1080p">1080x1920 Dikey Short (Full HD Ultra)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Altyazı Görünümü:</label>
              <button
                type="button"
                onClick={() => setIncludeSubtitles(!includeSubtitles)}
                disabled={isRendering}
                className={`w-full px-3 py-2.5 rounded-xl border text-left font-semibold flex items-center justify-between transition cursor-pointer ${
                  includeSubtitles
                    ? 'bg-red-950/40 border-red-500/50 text-red-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span>{includeSubtitles ? '✓ Vurgulu Altyazılar Dahil' : '✕ Altyazısız'}</span>
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Model Information Card */}
          <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Kullanılan AI & Medya Modelleri Bilgisi</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block font-medium">AI Senaryo Modeli:</span>
                <span className="text-emerald-400 font-semibold">Google Gemini 2.5 Flash / 3.1 Flash Lite</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block font-medium">Stok Video Motoru:</span>
                <span className="text-sky-400 font-semibold">Pexels HD Video API</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-400 block font-medium">Seslendirme Motoru:</span>
                <span className="text-purple-400 font-semibold">Gemini TTS (Öncelikli) & Edge TTS (Yedek)</span>
              </div>
            </div>
          </div>

          {/* Rendering Status Progress Bar */}
          {isRendering && (
            <div className="space-y-3 bg-slate-900/90 p-5 rounded-xl border border-slate-800 shadow-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-200 font-bold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                  {renderStatusText}
                </span>
                <span className="font-extrabold text-red-400 text-sm">{progress}%</span>
              </div>

              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-400 italic text-center">
                Canlı seslendirme, görseller ve altyazılar senkronize edilerek işleniyor...
              </p>
            </div>
          )}

          {/* Rendered Video Download Box */}
          {renderedVideoUrl && !isRendering && (
            <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-4 shadow-lg">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Video İşleme Tamamlandı! HD Dosyanız Hazır.</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={renderedVideoUrl}
                  download={`yt_short_${topic.substring(0, 15).replace(/\s+/g, '_')}.mp4`}
                  className="w-full px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Videoyu İndir (.MP4)</span>
                </a>
              </div>
            </div>
          )}

          {/* Action Button */}
          {!isRendering && (
            <button
              onClick={startVideoRender}
              className="w-full py-4 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-red-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Video className="w-5 h-5" />
              <span>{renderedVideoUrl ? 'Videoyu Yeniden Oluştur (Re-render)' : 'Videoyu Render Et ve Oluştur'}</span>
            </button>
          )}
        </div>

        {/* Right Live Preview / Canvas Column */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 min-h-[360px]">
          <h5 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Video Render Tuvali (9:16 Canvas)</span>
          </h5>

          {renderedVideoUrl && !isRendering ? (
            <div className="flex flex-col items-center space-y-3">
              <video
                src={renderedVideoUrl}
                controls
                autoPlay
                className="max-h-[380px] aspect-[9/16] rounded-2xl border-2 border-emerald-500/50 shadow-2xl bg-black object-contain"
              />
              <span className="text-[11px] text-emerald-400 font-semibold">✓ İşlenmiş Tam Video Önizleme</span>
            </div>
          ) : (
            <div className="relative flex flex-col items-center justify-center">
              <canvas
                ref={canvasRef}
                className={`max-h-[380px] aspect-[9/16] rounded-2xl border-2 border-red-500/30 shadow-2xl bg-black object-contain ${
                  isRendering ? 'block' : 'hidden'
                }`}
              />
              {!isRendering && (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-500">
                  <Film className="w-12 h-12 text-slate-700 stroke-[1.5]" />
                  <p className="text-xs font-medium text-slate-400">
                    "Videoyu Render Et" butonuna bastığınızda video burada canlı olarak oluşturulacaktır.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

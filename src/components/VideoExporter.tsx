import React, { useState, useRef, useEffect } from 'react';
import { Scene } from '../types';
import { Video, Download, RefreshCw, CheckCircle, Play, Film, Sparkles, Layers, Sliders } from 'lucide-react';

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

  const startVideoRender = async () => {
    if (scenes.length === 0 || isRendering) return;

    setIsRendering(true);
    setProgress(0);
    setRenderedVideoUrl(null);
    setRenderStatusText('Initializing Video Canvas...');

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

    // Prepare audio destination stream for recording speech
    const stream = canvas.captureStream(30);
    let mediaRecorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];

    const supportedTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    let selectedMime = supportedTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

    try {
      mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    } catch (e) {
      console.warn('MediaRecorder error, falling back to default options:', e);
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    }

    // Preload video elements for each scene
    setRenderStatusText('Loading stock video elements...');
    const loadedVideos: (HTMLVideoElement | null)[] = await Promise.all(
      scenes.map((s) => {
        return new Promise<HTMLVideoElement | null>((resolve) => {
          if (!s.video_url) return resolve(null);
          const v = document.createElement('video');
          v.crossOrigin = 'anonymous';
          v.src = s.video_url;
          v.muted = true;
          v.loop = true;
          v.playsInline = true;
          v.onloadeddata = () => resolve(v);
          v.onerror = () => resolve(null);
        });
      })
    );

    const isTurkish = language === 'tr' || /[çğışöüÇĞİŞÖÜ]/.test(topic);

    // Render loop scene by scene
    for (let i = 0; i < scenes.length; i++) {
      setCurrentRenderingScene(i + 1);
      const scene = scenes[i];
      const sceneVideo = loadedVideos[i];

      if (sceneVideo) {
        sceneVideo.play().catch(() => {});
      }

      setRenderStatusText(`Rendering Scene ${i + 1} / ${scenes.length}...`);

      // Speech synthesis for current scene voiceover
      const currentText = scene.text || '';
      let speechEnded = false;
      let activeCharIndex = 0;

      if (window.speechSynthesis && currentText) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(currentText);
        utterance.rate = speechRate;
        utterance.lang = isTurkish ? 'tr-TR' : 'en-US';

        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.lang.startsWith(isTurkish ? 'tr' : 'en'));
        if (match) utterance.voice = match;

        utterance.onboundary = (evt) => {
          if (evt.name === 'word') {
            activeCharIndex = evt.charIndex;
          }
        };

        utterance.onend = () => {
          speechEnded = true;
        };

        utterance.onerror = () => {
          speechEnded = true;
        };

        window.speechSynthesis.speak(utterance);
      } else {
        speechEnded = true;
      }

      // Minimum time per scene in milliseconds
      const minSceneTime = Math.max(3000, currentText.length * 75);
      const startTime = Date.now();

      // Frame animation loop for scene duration
      while (!speechEnded || Date.now() - startTime < minSceneTime) {
        ctx.clearRect(0, 0, width, height);

        // 1. Draw video background or gradient fallback
        if (sceneVideo && sceneVideo.readyState >= 2) {
          ctx.drawImage(sceneVideo, 0, 0, width, height);
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
        ctx.fillRect(0, height * 0.6, 0, height * 0.4);

        // 3. Header Branding Text
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'left';
        ctx.fillText('🔴 YT SHORTS AI', 40, 60);

        // 4. Draw Karaoke Subtitle Overlay
        if (includeSubtitles && currentText) {
          const rawWords = currentText.trim().split(/\s+/);
          if (rawWords.length > 0) {
            // Calculate active word index from activeCharIndex
            let activeWordIndex = -1;
            if (activeCharIndex >= 0) {
              let charCount = 0;
              for (let wIdx = 0; wIdx < rawWords.length; wIdx++) {
                const wLen = rawWords[wIdx].length;
                if (activeCharIndex >= charCount && activeCharIndex <= charCount + wLen) {
                  activeWordIndex = wIdx;
                  break;
                }
                charCount += wLen + 1;
              }
            }

            // Set typography relative to canvas resolution
            const fontSize = Math.round(width * 0.042); // ~30px on 720p, ~45px on 1080p
            ctx.font = `900 ${fontSize}px sans-serif, system-ui`;
            ctx.textAlign = 'left';

            const spaceWidth = ctx.measureText(' ').width;
            const maxLineWidth = width - 120; // 60px padding on each side

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

            rawWords.forEach((wText, index) => {
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
                originalIndex: index,
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

            // Calculate Banner Box dimensions
            const lineHeight = fontSize * 1.45;
            const boxPaddingY = Math.round(fontSize * 0.6);
            const boxHeight = lines.length * lineHeight + boxPaddingY * 2;
            const boxY = height - 160 - boxHeight;

            ctx.save();

            // Background banner overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(40, boxY, width - 80, boxHeight, 20);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Render each line and word
            lines.forEach((line, lineIdx) => {
              const lineY = boxY + boxPaddingY + (lineIdx + 0.72) * lineHeight;
              let startX = (width - line.totalWidth) / 2;

              line.words.forEach((wordObj) => {
                const isHighlight = wordObj.originalIndex === activeWordIndex;

                if (isHighlight) {
                  // Active word background pill (Amber/Yellow)
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

                  // Black text inside yellow highlight
                  ctx.fillStyle = '#000000';
                  ctx.fillText(wordObj.text, startX, lineY);
                } else {
                  // White text with drop shadow
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
        }

        // Calculate progress percentage
        const elapsedScenePct = Math.min(1, (Date.now() - startTime) / minSceneTime);
        const overallPct = Math.round(((i + elapsedScenePct) / scenes.length) * 100);
        setProgress(overallPct);

        await new Promise((r) => setTimeout(r, 33)); // ~30 fps
      }

      if (sceneVideo) {
        sceneVideo.pause();
      }
    }

    setRenderStatusText('Finalizing video file output...');
    window.speechSynthesis.cancel();

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      await new Promise((r) => setTimeout(r, 500));
    }

    const videoBlob = new Blob(chunks, { type: selectedMime || 'video/webm' });
    const generatedUrl = URL.createObjectURL(videoBlob);

    setRenderedVideoUrl(generatedUrl);
    setIsRendering(false);
    setProgress(100);
    setRenderStatusText('Video Render Complete!');
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Film className="w-5 h-5 text-red-500" />
          <h4 className="font-bold text-slate-100 text-sm">9:16 Shorts Video Renderer & Exporter</h4>
        </div>

        <span className="text-[10px] bg-red-500/10 text-red-400 font-bold px-2 py-0.5 rounded border border-red-500/20 uppercase">
          HD Export
        </span>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1.5">
          <label className="text-slate-400 font-medium">Video Quality / Aspect Ratio:</label>
          <select
            value={videoQuality}
            onChange={(e) => setVideoQuality(e.target.value as any)}
            disabled={isRendering}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="720p">720x1280 Vertical Short (Fast HD)</option>
            <option value="1080p">1080x1920 Vertical Short (Full HD)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-slate-400 font-medium">Subtitles Overlay:</label>
          <button
            type="button"
            onClick={() => setIncludeSubtitles(!includeSubtitles)}
            disabled={isRendering}
            className={`w-full px-3 py-2 rounded-xl border text-left font-semibold flex items-center justify-between transition ${
              includeSubtitles
                ? 'bg-red-950/40 border-red-500/50 text-red-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span>{includeSubtitles ? '✓ Burned-in Subtitles Included' : '✕ No Subtitles'}</span>
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hidden Canvas used for rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Rendering Status Progress Bar */}
      {isRendering && (
        <div className="space-y-2 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" />
              {renderStatusText}
            </span>
            <span className="font-bold text-red-400">{progress}%</span>
          </div>

          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Rendered Video Preview & Download */}
      {renderedVideoUrl && !isRendering && (
        <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
            <CheckCircle className="w-4 h-4" />
            <span>Shorts Video Rendered Successfully!</span>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href={renderedVideoUrl}
              download={`yt_short_${topic.substring(0, 15).replace(/\s+/g, '_')}.webm`}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4 / WebM Video File</span>
            </a>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isRendering && (
        <button
          onClick={startVideoRender}
          className="w-full py-3 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Video className="w-4 h-4" />
          <span>{renderedVideoUrl ? 'Re-render Video' : 'Render & Generate Final Video File'}</span>
        </button>
      )}
    </div>
  );
};

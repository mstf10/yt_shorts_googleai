import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { Scene } from '../types';
import {
  Video,
  Download,
  RefreshCw,
  CheckCircle,
  Play,
  Film,
  Sparkles,
  Layers,
  Sliders,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  subscribeVideoRender,
  getVideoRenderState,
  getEngineCanvas,
  startRender,
  cancelRender,
} from '../lib/videoRenderer';

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
  const renderState = useSyncExternalStore(subscribeVideoRender, getVideoRenderState);

  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'720p' | '1080p'>('720p');

  const isRendering = renderState.status === 'rendering';
  const { progress, currentScene, statusText, resultUrl, error } = renderState;

  const previewRef = useRef<HTMLDivElement | null>(null);

  // While rendering, mount the engine-owned live canvas into the preview area so
  // the user can watch the recording as it is produced in the background.
  useEffect(() => {
    if (!isRendering) return;
    const el = previewRef.current;
    const canvas = getEngineCanvas();
    if (el && canvas && canvas.parentNode !== el) {
      el.appendChild(canvas);
    }
  }, [isRendering, renderState.currentScene, renderState.progress, renderState.statusText]);

  const handleStartRender = () => {
    if (isRendering || scenes.length === 0) return;
    startRender({
      topic,
      scenes,
      selectedVoice,
      speechRate,
      language,
      includeSubtitles,
      videoQuality,
    });
  };

  const handleCancelRender = () => {
    cancelRender();
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
                  {statusText}
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

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Arka planda devam ediyor — bu pencereyi kapatabilirsiniz.
                </span>
                <button
                  type="button"
                  onClick={handleCancelRender}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  İptal Et
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {renderState.status === 'error' && error && (
            <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-bold">Render hatası oluştu</p>
                <p className="text-red-200/80 text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}
{/* Rendered Video Download Box */}
          {resultUrl && !isRendering && (
            <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-4 shadow-lg">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Video İşleme Tamamlandı! HD Dosyanız Hazır.</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={resultUrl}
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
              onClick={handleStartRender}
              className="w-full py-4 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-red-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Video className="w-5 h-5" />
              <span>{resultUrl ? 'Videoyu Yeniden Oluştur (Re-render)' : 'Videoyu Render Et ve Oluştur'}</span>
            </button>
          )}
        </div>

        {/* Right Live Preview / Canvas Column */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 min-h-[360px]">
          <h5 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Video Render Tuvali (9:16 Canvas)</span>
          </h5>

          {resultUrl && !isRendering ? (
            <div className="flex flex-col items-center space-y-3">
              <video
                src={resultUrl}
                controls
                autoPlay
                className="max-h-[380px] aspect-[9/16] rounded-2xl border-2 border-emerald-500/50 shadow-2xl bg-black object-contain"
              />
              <span className="text-[11px] text-emerald-400 font-semibold">✓ İşlenmiş Tam Video Önizleme</span>
            </div>
          ) : (
            <div className="relative flex flex-col items-center justify-center w-full">
              <div
                ref={previewRef}
                className={`max-h-[380px] aspect-[9/16] rounded-2xl border-2 overflow-hidden bg-black object-contain ${
                  isRendering ? 'border-red-500/30 shadow-2xl' : 'border-red-500/10'
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

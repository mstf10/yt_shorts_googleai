import React from 'react';
import { Scene } from '../types';
import { VOICE_OPTIONS } from '../data/presets';
import {
  Film,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Volume2,
  RefreshCw,
  Edit3,
  Search,
  CheckCircle,
  Video,
} from 'lucide-react';

interface StoryboardEditorProps {
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  speechRate: number;
  setSpeechRate: (r: number) => void;
  onRefreshSceneVideo: (index: number) => void;
  loadingVideoIndices: number[];
  onReorderScene: (fromIndex: number, toIndex: number) => void;
  activeSceneIndex: number;
  setActiveSceneIndex: (i: number) => void;
}

export const StoryboardEditor: React.FC<StoryboardEditorProps> = ({
  scenes,
  setScenes,
  selectedVoice,
  setSelectedVoice,
  speechRate,
  setSpeechRate,
  onRefreshSceneVideo,
  loadingVideoIndices,
  onReorderScene,
  activeSceneIndex,
  setActiveSceneIndex,
}) => {
  const handleTextChange = (index: number, newText: string) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, text: newText } : s))
    );
  };

  const handleQueryChange = (index: number, newQuery: string) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, visual_query: newQuery } : s))
    );
  };

  const handleDeleteScene = (index: number) => {
    if (scenes.length <= 1) return;
    setScenes((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, idx) => ({ ...s, scene: idx + 1 }))
    );
  };

  const handleAddScene = () => {
    const newIndex = scenes.length + 1;
    setScenes((prev) => [
      ...prev,
      {
        scene: newIndex,
        text: `Scene ${newIndex}: Add your narration script here.`,
        visual_query: 'cinematic 4k motion background',
      },
    ]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-6 space-y-5 sm:space-y-6 shadow-xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <Film className="w-5 h-5 text-red-500 shrink-0" /> Senaryo ve Sahne Düzenleyici
          </h2>
          <p className="text-xs text-slate-400">
            {scenes.length} Sahne oluşturuldu. Düzenlemek istediğiniz sahneye dokunun.
          </p>
        </div>

        {/* Voiceover Config */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold">Ses:</span>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              {VOICE_OPTIONS.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <span className="text-slate-400 font-semibold">Hız:</span>
            <select
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value={0.9}>0.9x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.15}>1.15x</option>
              <option value={1.3}>1.3x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scenes List */}
      <div className="space-y-3.5 sm:space-y-4">
        {scenes.map((scene, index) => {
          const isActive = activeSceneIndex === index;
          const isLoadingVideo = loadingVideoIndices.includes(index);

          return (
            <div
              key={index}
              onClick={() => setActiveSceneIndex(index)}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-800/90 border-red-500/80 shadow-lg shadow-red-500/5 ring-1 ring-red-500/30'
                  : 'bg-slate-950/60 hover:bg-slate-800/40 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      isActive
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    Sahne {scene.scene}
                  </span>
                  {isActive && (
                    <span className="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      Canlı
                    </span>
                  )}
                </div>

                {/* Scene Controls */}
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onReorderScene(index, index - 1)}
                    disabled={index === 0}
                    className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-400 hover:text-slate-200 border border-slate-800 active:scale-95 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Yukarı Taşı"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onReorderScene(index, index + 1)}
                    disabled={index === scenes.length - 1}
                    className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-400 hover:text-slate-200 border border-slate-800 active:scale-95 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Aşağı Taşı"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteScene(index)}
                    disabled={scenes.length <= 1}
                    className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-red-950/60 disabled:opacity-30 text-slate-400 hover:text-red-400 border border-slate-800 active:scale-95 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Sahneyi Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Narration Script Textarea */}
              <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-red-400" /> Seslendirme Metni (Narration):
                  </label>
                  <textarea
                    rows={2}
                    value={scene.text}
                    onChange={(e) => handleTextChange(index, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition resize-none leading-relaxed"
                    placeholder="Bu sahne için konuşulacak metni yazın..."
                  />
                </div>

                {/* Visual Search Query */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Search className="w-3 h-3 text-sky-400" /> Stok Video Arama Kelimesi:
                    </label>
                    <input
                      type="text"
                      value={scene.visual_query}
                      onChange={(e) => handleQueryChange(index, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                      placeholder="Örn: space galaxy black hole"
                    />
                  </div>

                  <button
                    onClick={() => onRefreshSceneVideo(index)}
                    disabled={isLoadingVideo}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs rounded-xl border border-slate-700/80 flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition cursor-pointer min-h-[38px]"
                    title="Bu sahne için yeni video klip çek"
                  >
                    {isLoadingVideo ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Video className="w-3.5 h-3.5" />
                    )}
                    <span>{isLoadingVideo ? 'Aranıyor...' : 'Videoyu Yenile'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-slate-800">
        <button
          onClick={handleAddScene}
          className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Yeni Sahne Ekle</span>
        </button>

        <span className="text-[11px] text-slate-500 italic text-center">
          İpucu: Düzenlemeleriniz canlı Shorts oyuncusuna anında yansır
        </span>
      </div>
    </div>
  );
};

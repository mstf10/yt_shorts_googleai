import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StoryboardEditor } from './components/StoryboardEditor';
import { ShortsPlayer } from './components/ShortsPlayer';
import { ExportModal } from './components/ExportModal';
import { ModelStatusPage } from './components/ModelStatusPage';
import { Scene } from './types';
import { Download, Sparkles, RefreshCw, Layers, Film, AlertCircle, Key } from 'lucide-react';

export function App() {
  const [currentPage, setCurrentPage] = useState<'studio' | 'model-status'>('studio');
  const [topic, setTopic] = useState('Evrenin en gizemli 5 kara deliği');
  const [language, setLanguage] = useState('tr');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [customGeminiKey, setCustomGeminiKey] = useState(() => localStorage.getItem('yt_shorts_gemini_key') || '');
  const [customPexelsKey, setCustomPexelsKey] = useState(() => localStorage.getItem('yt_shorts_pexels_key') || '');
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [pexelsConfigured, setPexelsConfigured] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showKeySettingsModal, setShowKeySettingsModal] = useState(false);
  const [loadingVideoIndices, setLoadingVideoIndices] = useState<number[]>([]);
  const [apiNotice, setApiNotice] = useState<{
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Persist keys to localStorage
  const handleSetCustomGeminiKey = (key: string) => {
    setCustomGeminiKey(key);
    if (key) {
      localStorage.setItem('yt_shorts_gemini_key', key);
    } else {
      localStorage.removeItem('yt_shorts_gemini_key');
    }
  };

  const handleSetCustomPexelsKey = (key: string) => {
    setCustomPexelsKey(key);
    if (key) {
      localStorage.setItem('yt_shorts_pexels_key', key);
    } else {
      localStorage.removeItem('yt_shorts_pexels_key');
    }
  };

  // Fetch Pexels video for a specific scene
  const fetchVideoForScene = useCallback(async (index: number, query: string, apiKey?: string) => {
    setLoadingVideoIndices((prev) => [...prev, index]);
    try {
      const res = await fetch('/api/fetch-pexels-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          pexelsApiKey: apiKey || customPexelsKey,
        }),
      });
      const data = await res.json();
      if (data.keyError) {
        setApiNotice({
          type: 'warning',
          title: 'Pexels API Key Hatası (401)',
          message: data.error || 'Pexels API anahtarınız geçersiz. Varsayılan HD videolar kullanılıyor.',
          actionLabel: 'API Keyleri Düzenle',
          onAction: () => setShowKeySettingsModal(true),
        });
      }
      if (data.video_url) {
        setScenes((prev) =>
          prev.map((s, i) =>
            i === index
              ? { ...s, video_url: data.video_url, video_thumbnail: data.thumbnail }
              : s
          )
        );
      }
    } catch (e) {
      console.error('Failed to fetch video for scene:', index, e);
    } finally {
      setLoadingVideoIndices((prev) => prev.filter((i) => i !== index));
    }
  }, [customPexelsKey]);

  // Main Script & Video Generation Pipeline
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setActiveSceneIndex(0);

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          language,
          apiKey: customGeminiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const isKeyErr = data.keyError || res.status === 401 || res.status === 403;
        const isQuotaErr = data.quotaError || res.status === 429;

        setApiNotice({
          type: 'error',
          title: isKeyErr
            ? 'Geçersiz Gemini API Key (401 / 403)'
            : isQuotaErr
            ? 'Gemini API Kota Limiti (429 Rate Limit)'
            : 'Üretim Yapılamadı (Gemini API Hatası)',
          message: data.error || 'Gemini API yanıt vermediği için herhangi bir senaryo üretilmedi.',
          actionLabel: 'API Keyleri Düzenle',
          onAction: () => setShowKeySettingsModal(true),
        });
        if (!data.scenes || data.scenes.length === 0) {
          setScenes([]);
        }
        return;
      }

      if (data.notice) {
        setApiNotice({
          type: 'warning',
          title: 'API Durumu',
          message: data.notice,
          actionLabel: 'API Keyleri Düzenle',
          onAction: () => setShowKeySettingsModal(true),
        });
      } else {
        setApiNotice(null);
      }

      if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
        const generatedScenes: Scene[] = data.scenes;
        setScenes(generatedScenes);

        // Fetch videos for all scenes in parallel
        generatedScenes.forEach((scene, index) => {
          fetchVideoForScene(index, scene.visual_query);
        });
      }
    } catch (err: any) {
      console.error('Failed to generate script:', err);
      setApiNotice({
        type: 'error',
        title: 'Bağlantı Hatası',
        message: 'Senaryo sunucusuna ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.',
        actionLabel: 'API Keyleri Kontrol Et',
        onAction: () => setShowKeySettingsModal(true),
      });
    } finally {
      setIsGenerating(false);
    }
  }, [topic, language, customGeminiKey, fetchVideoForScene]);

  // Check server API status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setGeminiConfigured(data.geminiConfigured);
        setPexelsConfigured(data.pexelsConfigured);
      })
      .catch((err) => console.error('Status check failed:', err));
  }, []);

  const handleRefreshSceneVideo = (index: number) => {
    const scene = scenes[index];
    if (scene) {
      fetchVideoForScene(index, scene.visual_query);
    }
  };

  const handleReorderScene = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= scenes.length) return;
    const updated = [...scenes];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setScenes(updated.map((s, idx) => ({ ...s, scene: idx + 1 })));
  };

  const [mobileTab, setMobileTab] = useState<'editor' | 'player'>('editor');

  return (
    <div className="min-h-dvh w-full bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-red-500 selection:text-white">
      <div className="sticky top-0 z-30">
      <Header
        topic={topic}
        setTopic={setTopic}
        language={language}
        setLanguage={setLanguage}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        geminiConfigured={geminiConfigured}
        pexelsConfigured={pexelsConfigured}
        customGeminiKey={customGeminiKey}
        setCustomGeminiKey={handleSetCustomGeminiKey}
        customPexelsKey={customPexelsKey}
        setCustomPexelsKey={handleSetCustomPexelsKey}
        onOpenModelStatus={() => setCurrentPage('model-status')}
        showKeySettingsModal={showKeySettingsModal}
        setShowKeySettingsModal={setShowKeySettingsModal}
      />
      </div>

      {currentPage === 'model-status' ? (
        <div className="w-full">
          <ModelStatusPage
            customGeminiKey={customGeminiKey}
            customPexelsKey={customPexelsKey}
            onBackToStudio={() => setCurrentPage('studio')}
            onOpenSettings={() => {
              setCurrentPage('studio');
              setShowKeySettingsModal(true);
            }}
          />
        </div>
      ) : (
        <>
          {/* API Key / System Status Notice Banner */}
      {apiNotice && (
        <div className="w-full px-4 sm:px-6 mt-3">
          <div
            className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm font-medium transition shadow-lg ${
              apiNotice.type === 'error'
                ? 'bg-red-950/90 border-red-800/90 text-red-100 shadow-red-950/40'
                : apiNotice.type === 'warning'
                ? 'bg-amber-950/90 border-amber-800/90 text-amber-100 shadow-amber-950/40'
                : 'bg-blue-950/90 border-blue-800/90 text-blue-100 shadow-blue-950/40'
            }`}
          >
            <div className="flex items-start sm:items-center space-x-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0 text-red-400" />
              <div>
                <span className="font-bold mr-1.5 text-white">{apiNotice.title}:</span>
                <span>{apiNotice.message}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {apiNotice.actionLabel && apiNotice.onAction && (
                <button
                  onClick={apiNotice.onAction}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Key className="w-3.5 h-3.5 text-amber-300" />
                  <span>{apiNotice.actionLabel}</span>
                </button>
              )}
              <button
                onClick={() => setApiNotice(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
                title="Kapat"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher Bar (Visible on mobile < lg) */}
      <div className="lg:hidden sticky top-[69px] z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800/80 px-4 py-2">
        <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMobileTab('editor')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mobileTab === 'editor'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Senaryo ve Sahneler</span>
          </button>
          <button
            onClick={() => setMobileTab('player')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mobileTab === 'player'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Shorts Önizleme & Export</span>
          </button>
        </div>
      </div>

      <main className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 px-3 sm:px-6 pt-2 sm:pt-3 pb-4 items-start">
        
        {/* Left Column: Storyboard & Script Editor */}
        <section className={`lg:col-span-7 space-y-4 ${mobileTab === 'editor' ? 'block' : 'hidden lg:block'}`}>
          <StoryboardEditor
            scenes={scenes}
            setScenes={setScenes}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            speechRate={speechRate}
            setSpeechRate={setSpeechRate}
            onRefreshSceneVideo={handleRefreshSceneVideo}
            loadingVideoIndices={loadingVideoIndices}
            onReorderScene={handleReorderScene}
            activeSceneIndex={activeSceneIndex}
            setActiveSceneIndex={setActiveSceneIndex}
          />
        </section>

        {/* Right Column: 9:16 Shorts Player & Actions */}
        <section className={`lg:col-span-5 flex flex-col items-center space-y-4 sm:space-y-6 ${mobileTab === 'player' ? 'block' : 'hidden lg:block'}`}>
          
          <div className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center space-x-2">
              <Film className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-slate-200">YouTube Short Önizleme</span>
            </div>

            <button
              onClick={() => setIsExportOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-red-500/20 transition active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Videoyu İndir / Export</span>
            </button>
          </div>

          <ShortsPlayer
            scenes={scenes}
            activeSceneIndex={activeSceneIndex}
            setActiveSceneIndex={setActiveSceneIndex}
            selectedVoice={selectedVoice}
            speechRate={speechRate}
            topic={topic}
            language={language}
          />
        </section>
      </main>
      </>
      )}

      {/* Footer info bar */}
      <footer className="border-t border-slate-900 py-4 bg-slate-950 text-center text-xs text-slate-500">
        <p>YT Shorts AI Generator • Powered by Google Gemini 3.5 & 3.1 Flash Lite and Pexels Video Engine</p>
      </footer>

      {/* Export Modal */}
      <ExportModal
        topic={topic}
        scenes={scenes}
        language={language}
        selectedVoice={selectedVoice}
        speechRate={speechRate}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}

export default App;

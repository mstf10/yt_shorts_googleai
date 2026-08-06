import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StoryboardEditor } from './components/StoryboardEditor';
import { ShortsPlayer } from './components/ShortsPlayer';
import { ExportModal } from './components/ExportModal';
import { Scene } from './types';
import { Download, Sparkles, RefreshCw, Layers, Film } from 'lucide-react';

export function App() {
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
  const [loadingVideoIndices, setLoadingVideoIndices] = useState<number[]>([]);

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

  // Check server API status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setGeminiConfigured(data.geminiConfigured);
        setPexelsConfigured(data.pexelsConfigured);
      })
      .catch((err) => console.error('Status check failed:', err));

    // Initial default generation on first open
    handleGenerate();
  }, []);

  // Fetch Pexels video for a specific scene
  const fetchVideoForScene = async (index: number, query: string, apiKey?: string) => {
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
  };

  // Main Script & Video Generation Pipeline
  const handleGenerate = async () => {
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
      if (data.scenes && Array.isArray(data.scenes)) {
        const generatedScenes: Scene[] = data.scenes;
        setScenes(generatedScenes);

        // Fetch videos for all scenes in parallel
        generatedScenes.forEach((scene, index) => {
          fetchVideoForScene(index, scene.visual_query);
        });
      }
    } catch (err) {
      console.error('Failed to generate script:', err);
    } finally {
      setIsGenerating(false);
    }
  };

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-red-500 selection:text-white">
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
      />

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
            <span>Canlı Shorts & Export</span>
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
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
        <section className={`lg:col-span-5 flex flex-col items-center space-y-4 sm:space-y-6 lg:sticky lg:top-24 ${mobileTab === 'player' ? 'block' : 'hidden lg:block'}`}>
          
          <div className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center space-x-2">
              <Film className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-slate-200">YouTube Short Canlı Sahne</span>
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

      {/* Footer info bar */}
      <footer className="border-t border-slate-900 py-4 bg-slate-950 text-center text-xs text-slate-500">
        <p>YT Shorts AI Generator • Powered by Google Gemini 3.6 Flash & Pexels Video Engine</p>
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

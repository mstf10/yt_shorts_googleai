import React, { useState } from 'react';
import { Youtube, Sparkles, Key, CheckCircle, AlertCircle, Languages, RefreshCw, Wand2 } from 'lucide-react';
import { PRESET_TOPICS } from '../data/presets';

interface HeaderProps {
  topic: string;
  setTopic: (t: string) => void;
  language: string;
  setLanguage: (l: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  geminiConfigured: boolean;
  pexelsConfigured: boolean;
  customGeminiKey: string;
  setCustomGeminiKey: (k: string) => void;
  customPexelsKey: string;
  setCustomPexelsKey: (k: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  topic,
  setTopic,
  language,
  setLanguage,
  onGenerate,
  isGenerating,
  geminiConfigured,
  pexelsConfigured,
  customGeminiKey,
  setCustomGeminiKey,
  customPexelsKey,
  setCustomPexelsKey,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !isGenerating) {
      onGenerate();
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 rounded-xl shadow-lg shadow-red-500/20 text-white">
                <Youtube className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
                  YT Shorts AI <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-medium">Gemini 3.6</span>
                </h1>
                <p className="text-xs text-slate-400">Automated Video Script, Voiceover & Stock Video Studio</p>
              </div>
            </div>

            {/* Mobile Key Status Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              title="API Settings"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>

          {/* Search / Topic Generator Input Bar */}
          <form onSubmit={handleSubmit} className="w-full md:flex-1 max-w-2xl">
            <div className="relative flex items-center">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter topic (e.g. '5 Secrets of Ancient Pyramids', 'Black Hole Physics')..."
                className="w-full pl-4 pr-32 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm transition"
              />

              <div className="absolute right-1.5 flex items-center space-x-1">
                {/* Language selection dropdown */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer"
                  title="Script Language"
                >
                  <option value="tr">TR 🇹🇷</option>
                  <option value="en">EN 🇺🇸</option>
                  <option value="es">ES 🇪🇸</option>
                  <option value="de">DE 🇩🇪</option>
                  <option value="fr">FR 🇫🇷</option>
                </select>

                <button
                  type="submit"
                  disabled={isGenerating || !topic.trim()}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-md transition cursor-pointer"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isGenerating ? 'Building...' : 'Generate'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Key Status & Config Modal toggle */}
          <div className="hidden md:flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Gemini:</span>
              {geminiConfigured || customGeminiKey ? (
                <span className="flex items-center text-emerald-400 font-medium gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Ready
                </span>
              ) : (
                <span className="flex items-center text-amber-400 font-medium gap-1" title="Using Smart Fallback Engine">
                  <AlertCircle className="w-3.5 h-3.5" /> Fallback
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Pexels:</span>
              {pexelsConfigured || customPexelsKey ? (
                <span className="flex items-center text-emerald-400 font-medium gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Ready
                </span>
              ) : (
                <span className="flex items-center text-sky-400 font-medium gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Stock
                </span>
              )}
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Configure API Keys"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preset Prompt Chips */}
        <div className="mt-3 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-amber-400" /> Quick Topics:
          </span>
          {PRESET_TOPICS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTopic(preset.title);
                setLanguage(preset.language);
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 shrink-0 transition"
            >
              {preset.icon} {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 text-xs">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <Key className="w-4 h-4 text-red-400" /> API Key Configurations
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-slate-400">
              Girilen API key'ler tarayıcınıza (localStorage) otomatik olarak kaydedilir. Sunucu varsayılanlarını değiştirmek için kendi key'lerinizi girebilirsiniz.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>Gemini API Key</span>
                  {customGeminiKey && <span className="text-[10px] text-emerald-400 font-normal">✓ Kaydedildi (Saved)</span>}
                </label>
                <input
                  type="password"
                  value={customGeminiKey}
                  onChange={(e) => setCustomGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>Pexels API Key</span>
                  {customPexelsKey && <span className="text-[10px] text-emerald-400 font-normal">✓ Kaydedildi (Saved)</span>}
                </label>
                <input
                  type="password"
                  value={customPexelsKey}
                  onChange={(e) => setCustomPexelsKey(e.target.value)}
                  placeholder="5363... / pexels token"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { Youtube, Sparkles, Key, CheckCircle, AlertCircle, RefreshCw, Wand2, ShieldCheck, XCircle, Cpu, Menu, ChevronDown, Sliders, Info } from 'lucide-react';
import { PRESET_TOPICS } from '../data/presets';

interface KeyTestResult {
  gemini: {
    configured: boolean;
    working: boolean;
    status: string;
    message: string;
  };
  pexels: {
    configured: boolean;
    working: boolean;
    status: string;
    message: string;
  };
}

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
  onOpenModelStatus?: () => void;
  showKeySettingsModal?: boolean;
  setShowKeySettingsModal?: (open: boolean) => void;
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
  onOpenModelStatus,
  showKeySettingsModal,
  setShowKeySettingsModal,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [internalShowKeySettings, setInternalShowKeySettings] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<KeyTestResult | null>(null);

  const showKeySettings = showKeySettingsModal !== undefined ? showKeySettingsModal : internalShowKeySettings;
  const setShowKeySettings = (open: boolean) => {
    setInternalShowKeySettings(open);
    if (setShowKeySettingsModal) {
      setShowKeySettingsModal(open);
    }
  };

  const hasKeyError = Boolean(
    testResults && (
      testResults.gemini?.status === 'error' ||
      testResults.pexels?.status === 'error'
    )
  );

  const runKeyTest = async (gKey?: string, pKey?: string) => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/test-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiKey: gKey !== undefined ? gKey : customGeminiKey,
          pexelsKey: pKey !== undefined ? pKey : customPexelsKey,
        }),
      });
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      console.error('Key test error:', err);
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    runKeyTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !isGenerating) {
      onGenerate();
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900 relative overflow-x-hidden">
      <div className="w-full px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          
          {/* Logo & Brand & Menu Button */}
          <div className="flex items-center justify-between w-full md:w-auto shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 rounded-xl shadow-lg shadow-red-500/20 text-white shrink-0">
                <Youtube className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight">
                  YT Shorts AI
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400">Yapay Zeka Shorts & Voiceover Stüdyosu</p>
              </div>
            </div>

            {/* Main Menu Button */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition active:scale-95 cursor-pointer font-bold text-xs shadow-sm"
                title="Stüdyo Menüsü"
              >
                <div className="relative">
                  <Menu className="w-4 h-4 text-red-400 shrink-0" />
                  {hasKeyError && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </div>
                <span>Menü</span>
                {hasKeyError && (
                  <span className="bg-red-900/80 text-red-200 text-[10px] px-1.5 py-0.5 rounded font-extrabold border border-red-700">
                    Key Hatası
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Nav Menu Dropdown Overlay */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-3 z-50 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-2 py-1 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span>Stüdyo Menüsü</span>
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="text-slate-500 hover:text-slate-300 p-1 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Menu Option 1: Kota & Gemini Modelleri */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenModelStatus) onOpenModelStatus();
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950/80 hover:bg-red-950/40 border border-slate-800 hover:border-red-800/80 transition group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-red-950/80 border border-red-800/60 text-red-400 group-hover:bg-red-900/80 shrink-0">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-200 group-hover:text-red-300 flex items-center gap-1.5">
                        <span>Gemini Modelleri & Kota</span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        Canlı model durumları, 15 RPM / 1.500 RPD limitleri ve anlık kalan kullanım
                      </div>
                    </div>
                  </button>

                  {/* Menu Option 2: API Keys Configuration */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowKeySettings(!showKeySettings);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400 group-hover:bg-amber-900/80 shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-200 group-hover:text-amber-300 flex items-center gap-1.5">
                        <span>API Anahtarları (Keyler)</span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        Özel Gemini ve Pexels API key yönetimi ve canlı test paneli
                      </div>
                    </div>
                  </button>

                  {/* Menu Option 3: Uygulama Hakkında */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowAboutModal(true);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400 group-hover:bg-blue-900/80 shrink-0">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-200 group-hover:text-blue-300 flex items-center gap-1.5">
                        <span>Uygulama Hakkında</span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        YT Shorts AI özellikleri, çalışma mantığı ve seslendirme teknolojileri
                      </div>
                    </div>
                  </button>

                  {/* Menu Quick Status Overview */}
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Sistem Durumu</div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Gemini Key:</span>
                      {testResults?.gemini?.working ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Bağlı
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Sunucu / Yedek
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Pexels Key:</span>
                      {testResults?.pexels?.working ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Özel Key
                        </span>
                      ) : (
                        <span className="text-sky-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Stok HD
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search / Topic Generator Input Bar */}
          <form onSubmit={handleSubmit} className="w-full md:flex-1 max-w-2xl">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950 p-1.5 sm:p-1 rounded-2xl border border-slate-700/80 shadow-inner">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Konu girin (Örn: 'Kara delikler hakkındaki 5 bilimsel gerçek')..."
                className="w-full px-3.5 py-2.5 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs sm:text-sm"
              />

              <div className="flex items-center gap-1.5 justify-end shrink-0 px-1 pb-1 sm:pb-0">
                {/* Language selection dropdown */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-red-500 cursor-pointer min-h-[38px]"
                  title="Senaryo Dili"
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
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer min-h-[38px] shrink-0"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  <span>{isGenerating ? 'Oluşturuluyor...' : 'Oluştur'}</span>
                </button>
              </div>
            </div>
          </form>

        </div>

        {/* Preset Prompt Chips */}
        <div className="mt-3 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-amber-400" /> Hızlı Konular:
          </span>
          {PRESET_TOPICS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTopic(preset.title);
                setLanguage(preset.language);
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 shrink-0 transition cursor-pointer"
            >
              {preset.icon} {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* Settings & API Key Tester Panel */}
      {showKeySettings && (
        <div className="bg-slate-900/95 border-t border-slate-800 p-4 text-xs">
          <div className="max-w-3xl mx-auto space-y-4 max-h-[calc(100dvh-90px)] overflow-y-auto pr-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-400 shrink-0" /> API Anahtarları Yapılandırma Paneli
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setShowKeySettings(false);
                    if (onOpenModelStatus) onOpenModelStatus();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-950/90 hover:bg-red-900/90 text-red-300 hover:text-red-100 border border-red-800/80 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Gemini Modelleri ve Kota Sayfası"
                >
                  <Cpu className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>Model & Kota</span>
                </button>
                <button
                  onClick={() => setShowKeySettings(false)}
                  className="text-slate-400 hover:text-slate-200 font-bold px-2 py-1 cursor-pointer"
                >
                  ✕ Kapat
                </button>
              </div>
            </div>

            <p className="text-slate-400 leading-relaxed">
              Girilen API anahtarları tarayıcınıza (localStorage) güvenle kaydedilir. Özel anahtar girebilir veya varsayılan sunucu anahtarını kullanabilirsiniz.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>Gemini API Key</span>
                  {customGeminiKey && <span className="text-[10px] text-emerald-400 font-normal">✓ Özel Key</span>}
                </label>
                <input
                  type="password"
                  value={customGeminiKey}
                  onChange={(e) => {
                    setCustomGeminiKey(e.target.value);
                    runKeyTest(e.target.value, customPexelsKey);
                  }}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>Pexels API Key</span>
                  {customPexelsKey && <span className="text-[10px] text-emerald-400 font-normal">✓ Özel Key</span>}
                </label>
                <input
                  type="password"
                  value={customPexelsKey}
                  onChange={(e) => {
                    setCustomPexelsKey(e.target.value);
                    runKeyTest(customGeminiKey, e.target.value);
                  }}
                  placeholder="5363... / pexels token"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 text-xs"
                />
              </div>
            </div>

            {/* Key Test Results & Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-800">
              <button
                onClick={() => runKeyTest()}
                disabled={isTesting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shrink-0"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isTesting ? 'Key\'ler Test Ediliyor...' : 'API Key\'leri Test Et'}</span>
              </button>

              {testResults && (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Gemini Result Box */}
                  <div
                    className={`p-2 rounded-lg border flex items-start gap-2 ${
                      testResults.gemini.working
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                        : testResults.gemini.status === 'error'
                        ? 'bg-red-950/40 border-red-800/80 text-red-300'
                        : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                    }`}
                  >
                    {testResults.gemini.working ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : testResults.gemini.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">Gemini API</div>
                      <div className="text-[11px] opacity-90 leading-tight">{testResults.gemini.message}</div>
                    </div>
                  </div>

                  {/* Pexels Result Box */}
                  <div
                    className={`p-2 rounded-lg border flex items-start gap-2 ${
                      testResults.pexels.working
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                        : testResults.pexels.status === 'error'
                        ? 'bg-red-950/40 border-red-800/80 text-red-300'
                        : 'bg-sky-950/40 border-sky-800/80 text-sky-300'
                    }`}
                  >
                    {testResults.pexels.working ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : testResults.pexels.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">Pexels Video API</div>
                      <div className="text-[11px] opacity-90 leading-tight">{testResults.pexels.message}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Uygulama Hakkında Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400">
                  <Youtube className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">YT Shorts AI Stüdyosu Hakkında</h3>
                  <p className="text-xs text-slate-400">Yapay Zeka Shorts & Voiceover Teknolojileri</p>
                </div>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>YT Shorts AI Nedir?</span>
                </div>
                <p className="text-slate-400">
                  YT Shorts AI; YouTube Shorts, TikTok ve Instagram Reels platformları için saniyeler içinde dikey (9:16) video senaryoları, seslendirmeler ve HD stok videolar üreten yapay zeka stüdyosudur.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200 text-xs">Öne Çıkan Sistem Özellikleri:</h4>
                <ul className="space-y-1.5 text-slate-400 list-disc list-inside pl-1">
                  <li><strong className="text-slate-200">Gemini Senaryo Motoru:</strong> Konunuza uygun hook, sahne metinleri, görsel arama terimleri ve ses tonlamaları oluşturur.</li>
                  <li><strong className="text-slate-200">Çoklu Yapay Zeka Seslendirme:</strong> Öncelikli Gemini 3.1 Flash / 2.5 Pro TTS motoru ve otomatik Edge TTS (Microsoft Read Aloud) yedekleme sistemi.</li>
                  <li><strong className="text-slate-200">HD Stok Videolar:</strong> Pexels kütüphanesinden konularla eşleşen 1080p dikey stok videoları sahnelere otomatik çeker.</li>
                  <li><strong className="text-slate-200">Senkronize Oynatıcı & Altyazı:</strong> Sahneler arası ses ve video senkronizasyonu, SRT altyazı ve MP4 / ses indirme seçeneği.</li>
                  <li><strong className="text-slate-200">Canlı Kota & Durum Takibi:</strong> Dakikalık ve günlük API kotalarını anlık olarak izleyen akıllı takip sistemi.</li>
                </ul>
              </div>

              <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-red-200/90 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>
                  API anahtarınızı menüdeki <strong>API Anahtarları</strong> kısmından yönetebilir, canlı limit durumlarını <strong>Gemini Modelleri & Kota</strong> sayfasından takip edebilirsiniz.
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowAboutModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};



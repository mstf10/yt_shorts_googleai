import React, { useState } from 'react';
import { Scene } from '../types';
import { VideoExporter } from './VideoExporter';
import { Download, Copy, Check, FileText, Code, Video, X, Cpu } from 'lucide-react';

interface ExportModalProps {
  topic: string;
  scenes: Scene[];
  language: string;
  selectedVoice: string;
  speechRate: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  topic,
  scenes,
  language,
  selectedVoice,
  speechRate,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'json' | 'markdown'>('video');

  if (!isOpen) return null;

  const jsonExportData = {
    topic,
    language,
    models_used: {
      script_generation: "Google Gemini 2.5 Flash / 3.1 Flash Lite",
      stock_video_engine: "Pexels HD Stock Video API",
      voiceover_engine: "Google TTS & Web Speech Synthesis API",
    },
    scenes: scenes.map((s) => ({
      scene: s.scene,
      text: s.text,
      visual_query: s.visual_query,
      video_url: s.video_url || null,
    })),
  };

  const jsonExport = JSON.stringify(jsonExportData, null, 2);

  const markdownExport = `# YouTube Short Script: ${topic}

**Language**: ${language}

### 🤖 Kullanılan AI & Medya Modelleri
- **Senaryo ve Sahne AI Modeli**: Google Gemini 2.5 Flash / 3.1 Flash Lite
- **Stok Video Motoru**: Pexels HD Stock Video API
- **Seslendirme Motoru**: Google TTS & Web Speech Synthesis API

## Scenes

${scenes
  .map(
    (s) =>
      `### Scene ${s.scene}\n- **Narration**: "${s.text}"\n- **Stock Query**: \`${s.visual_query}\`\n`
  )
  .join('\n')}`;

  const getExportText = () => {
    if (activeTab === 'json') return jsonExport;
    return markdownExport;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadText = () => {
    const text = getExportText();
    const ext = activeTab === 'json' ? 'json' : 'md';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yt_short_${topic.substring(0, 15).replace(/\s+/g, '_')}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full h-full flex flex-col p-3.5 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl relative overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 sm:pb-4 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 shrink-0">
              <Download className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-xl font-bold text-slate-100 leading-tight">Video Dışa Aktarma & Stüdyo Modu</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">9:16 dikey video oluşturma ve senaryo dışa aktarma</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer min-h-[38px] shrink-0"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Kapat</span>
          </button>
        </div>

        {/* Export Format Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-800 pb-2.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('video')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer min-h-[38px] ${
              activeTab === 'video'
                ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-lg shadow-red-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-4 h-4" /> 🎬 HD Video Render
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer min-h-[38px] ${
              activeTab === 'json'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4" /> JSON
          </button>
          <button
            onClick={() => setActiveTab('markdown')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer min-h-[38px] ${
              activeTab === 'markdown'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" /> Markdown
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'video' ? (
            <VideoExporter
              topic={topic}
              scenes={scenes}
              selectedVoice={selectedVoice}
              speechRate={speechRate}
              language={language}
            />
          ) : (
            <div className="flex flex-col h-full space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-xs text-slate-300">
                <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Kullanılan Modeller:</strong> Google Gemini 2.5/3.1 Flash, Pexels HD API, Google TTS API
                </span>
              </div>
              <div className="relative flex-1">
                <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-200 font-mono overflow-auto h-full max-h-[calc(100vh-320px)] border border-slate-800">
                  {getExportText()}
                </pre>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={handleCopy}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Kopyalandı!' : 'Metni Kopyala'}</span>
                </button>

                <button
                  onClick={handleDownloadText}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Dosya Olarak İndir</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


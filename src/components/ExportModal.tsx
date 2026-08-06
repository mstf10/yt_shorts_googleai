import React, { useState } from 'react';
import { Scene } from '../types';
import { VideoExporter } from './VideoExporter';
import { Download, Copy, Check, FileText, Code, Terminal, Video, X } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'video' | 'json' | 'markdown' | 'python'>('video');

  if (!isOpen) return null;

  const jsonExport = JSON.stringify(
    scenes.map((s) => ({
      scene: s.scene,
      text: s.text,
      visual_query: s.visual_query,
    })),
    null,
    2
  );

  const markdownExport = `# YouTube Short Script: ${topic}\n\n**Language**: ${language}\n\n## Scenes\n\n${scenes
    .map(
      (s) =>
        `### Scene ${s.scene}\n- **Narration**: "${s.text}"\n- **Stock Query**: \`${s.visual_query}\`\n`
    )
    .join('\n')}`;

  const pythonCommand = `# Run using local yt_shorts CLI or Colab:\npython yt_shorts.py "${topic.replace(
    /"/g,
    '\\"'
  )}"`;

  const getExportText = () => {
    if (activeTab === 'json') return jsonExport;
    if (activeTab === 'markdown') return markdownExport;
    return pythonCommand;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadText = () => {
    const text = getExportText();
    const ext = activeTab === 'json' ? 'json' : activeTab === 'markdown' ? 'md' : 'sh';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yt_short_${topic.substring(0, 15).replace(/\s+/g, '_')}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <Download className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-bold text-slate-100">Export Video & Script Assets</h3>
        </div>

        {/* Export Format Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('video')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'video'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" /> 🎬 Render Video (MP4/WebM)
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'json'
                ? 'bg-red-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" /> JSON Schema
          </button>
          <button
            onClick={() => setActiveTab('markdown')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'markdown'
                ? 'bg-red-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Markdown
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'python'
                ? 'bg-red-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> Python CLI Command
          </button>
        </div>

        {/* Video Renderer View */}
        {activeTab === 'video' ? (
          <VideoExporter
            topic={topic}
            scenes={scenes}
            selectedVoice={selectedVoice}
            speechRate={speechRate}
            language={language}
          />
        ) : (
          <>
            {/* Code Content View */}
            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-200 font-mono overflow-x-auto max-h-64 border border-slate-800">
                {getExportText()}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Content'}</span>
              </button>

              <button
                onClick={handleDownloadText}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md transition"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


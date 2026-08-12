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
  const [activeTab, setActiveTab] = useState<'video' | 'json' | 'markdown' | 'colab'>('video');

  if (!isOpen) return null;

  const jsonExportData = {
    topic,
    language,
    models_used: {
      script_generation: "Google Gemini 2.5 Flash / 3.1 Flash Lite",
      stock_video_engine: "Pexels HD Stock Video API",
      voiceover_engine: "Google Gemini TTS (Primary) & Edge TTS (Fallback)",
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
- **Seslendirme Motoru**: Google Gemini TTS (Öncelikli) & Edge TTS (Yedek)

## Scenes

${scenes
  .map(
    (s) =>
      `### Scene ${s.scene}\n- **Narration**: "${s.text}"\n- **Stock Query**: \`${s.visual_query}\`\n`
  )
  .join('\n')}`;

  const colabStory = {
    topic,
    language,
    scenes: scenes.map((s) => ({
      scene: s.scene,
      text: s.text,
      visual_query: s.visual_query,
      video_url: s.video_url || null,
    })),
  };

  const colabExport = `# Colab: YT Shorts AI video oluşturma
# Bu kod parçası, bu uygulamadan alınan export JSON'undan
# 9:16 YouTube Shorts videoları üretir.

!pip install -q moviepy gTTS requests pillow numpy

import os, re, json, math
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFont
from moviepy.editor import VideoFileClip, CompositeVideoClip, concatenate_videoclips, ImageClip
from moviepy.video.fx.all import resize
from gtts import gTTS

story = ${JSON.stringify(colabStory, null, 2)}

ROOT = Path('/content/yt_shorts_ai')
ROOT.mkdir(exist_ok=True, parents=True)
(VROOT := ROOT / 'videos').mkdir(exist_ok=True)
(AUDIO := ROOT / 'audio').mkdir(exist_ok=True)


def sanitize(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_]+', '_', name).strip('_')[:60] or 'scene'


def download_file(url: str, target: Path) -> bool:
    if not url:
        return False
    try:
        r = requests.get(url, stream=True, timeout=30)
        r.raise_for_status()
        with open(target, 'wb') as f:
            for chunk in r.iter_content(1024 * 1024):
                if chunk:
                    f.write(chunk)
        return True
    except Exception as e:
        print('Download failed for', url, e)
        return False


def ensure_video(scene_num: int, video_url: str | None) -> Path:
    out = VROOT / f'scene_{scene_num}.mp4'
    if out.exists():
        return out

    candidate = video_url or 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
    if download_file(candidate, out):
        return out

    fallback = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
    download_file(fallback, out)
    return out


def render_subtitle_image(text: str, width: int = 980, height: int = 220):
    image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    font_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
        '/usr/local/share/fonts/DejaVuSans-Bold.ttf',
    ]
    font = None
    for font_path in font_paths:
        if os.path.exists(font_path):
            font = ImageFont.truetype(font_path, 52)
            break
    if font is None:
        font = ImageFont.load_default()

    draw.text(
        (width / 2, height / 2),
        text,
        font=font,
        fill=(255, 255, 255, 255),
        anchor='mm',
        stroke_width=3,
        stroke_fill=(0, 0, 0, 255),
    )
    return np.array(image)


clips = []
for scene in story['scenes']:
    scene_num = int(scene['scene'])
    text = (scene.get('text') or '').strip()
    if not text:
        continue

    video_path = ensure_video(scene_num, scene.get('video_url'))
    clip = VideoFileClip(str(video_path))
    clip = clip.resize(height=1920)
    if clip.w > clip.h:
        crop_x = (clip.w - clip.h * 9 / 16) / 2
        clip = clip.crop(x1=crop_x, x2=clip.w - crop_x, y1=0, y2=clip.h)
    clip = clip.resize(width=1080)

    audio_path = AUDIO / f'voice_{scene_num}.mp3'
    if not audio_path.exists():
        tts = gTTS(text=text, lang='tr' if story.get('language') == 'tr' else 'en', slow=False)
        tts.save(str(audio_path))

    audio = __import__('moviepy.editor').editor.AudioFileClip(str(audio_path))
    clip = clip.set_audio(audio)
    clip = clip.subclip(0, min(clip.duration, audio.duration + 0.2))

    subtitle = ImageClip(
        render_subtitle_image(text),
        duration=clip.duration,
    )
    subtitle = subtitle.with_position(('center', 1500))
    clips.append(CompositeVideoClip([clip, subtitle]))

if not clips:
    raise ValueError('No valid scene text found in the JSON export.')

final_video = concatenate_videoclips(clips, method='compose')
final_video.write_videofile(
    str(ROOT / 'final_short.mp4'),
    fps=30,
    codec='libx264',
    audio_codec='aac',
    preset='veryfast',
    threads=4,
    remove_temp=True,
)

print(f'✅ Video oluşturuldu: {ROOT / "final_short.mp4"}')
`;

  const getExportText = () => {
    if (activeTab === 'json') return jsonExport;
    if (activeTab === 'markdown') return markdownExport;
    if (activeTab === 'colab') return colabExport;
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
          <button
            onClick={() => setActiveTab('colab')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer min-h-[38px] ${
              activeTab === 'colab'
                ? 'bg-gradient-to-r from-amber-500 to-red-500 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" /> Colab Python
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
              {activeTab === 'colab' && (
                <div className="bg-amber-950/20 border border-amber-800/60 p-3 rounded-xl flex items-center gap-2 text-xs text-amber-100">
                  <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Colab için hazır script:</strong> Bu kodu Google Colab not defterine yapıştırıp çalıştırabilirsiniz.
                  </span>
                </div>
              )}
              {activeTab !== 'colab' && (
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-xs text-slate-300">
                  <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Kullanılan Modeller:</strong> Google Gemini 2.5/3.1 Flash, Pexels HD API, Gemini TTS & Edge TTS
                  </span>
                </div>
              )}
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


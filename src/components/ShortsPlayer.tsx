import React, { useState, useEffect, useRef } from 'react';
import { Scene } from '../types';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  Disc,
  RotateCcw,
  Sparkles,
  Maximize2,
} from 'lucide-react';

interface ShortsPlayerProps {
  scenes: Scene[];
  activeSceneIndex: number;
  setActiveSceneIndex: React.Dispatch<React.SetStateAction<number>>;
  selectedVoice: string;
  speechRate: number;
  topic: string;
  language?: string;
}

export const ShortsPlayer: React.FC<ShortsPlayerProps> = ({
  scenes,
  activeSceneIndex,
  setActiveSceneIndex,
  selectedVoice,
  speechRate,
  topic,
  language = 'tr',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(14200);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentScene = scenes[activeSceneIndex] || scenes[0];
  const currentText = currentScene?.text || '';
  const targetLang = (language === 'tr' || /[çğışöüÇĞİŞÖÜ]/i.test(currentText) || /[çğışöüÇĞİŞÖÜ]/i.test(topic)) ? 'tr' : language;
  const isTurkish = targetLang === 'tr';
  const sceneWords = currentText.trim() ? currentText.trim().split(/\s+/) : [];

  // High quality audio voiceover player with dual engine (Server TTS + Web Speech API fallback)
  useEffect(() => {
    if (!isPlaying || !currentScene || isMuted || !currentText) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setActiveWordIndex(-1);
      return;
    }

    let isCancelled = false;
    let wordInterval: any = null;

    // Stop previous audio/speech
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const targetLang = isTurkish ? 'tr' : language;
    const savedGeminiKey = localStorage.getItem('yt_shorts_gemini_key') || '';
    const ttsUrl = `/api/tts?text=${encodeURIComponent(currentText)}&lang=${targetLang}${savedGeminiKey ? `&apiKey=${encodeURIComponent(savedGeminiKey)}` : ''}`;

    const audio = new Audio(ttsUrl);
    audio.playbackRate = speechRate;
    audioRef.current = audio;

    // Helper to start browser SpeechSynthesis fallback
    const startSpeechSynthesisFallback = () => {
      if (isCancelled || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentText);
      utterance.rate = speechRate;
      utterance.lang = isTurkish ? 'tr-TR' : targetLang === 'es' ? 'es-ES' : targetLang === 'de' ? 'de-DE' : targetLang === 'fr' ? 'fr-FR' : 'en-US';

      const applyVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          let match = null;
          if (isTurkish) {
            match = voices.find(
              (v) =>
                v.lang.toLowerCase().startsWith('tr') ||
                v.lang.toLowerCase().includes('tur') ||
                v.name.toLowerCase().includes('turkish') ||
                v.name.toLowerCase().includes('yelda') ||
                v.name.toLowerCase().includes('cem')
            );
          }
          if (!match) {
            match = voices.find(
              (v) =>
                v.name.toLowerCase().includes(selectedVoice.toLowerCase()) ||
                v.lang.toLowerCase().startsWith(targetLang)
            );
          }
          if (match) utterance.voice = match;
        }
      };

      applyVoice();
      window.speechSynthesis.onvoiceschanged = applyVoice;

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const charIdx = event.charIndex;
          let cumulative = 0;
          for (let i = 0; i < sceneWords.length; i++) {
            cumulative += sceneWords[i].length + 1;
            if (cumulative > charIdx) {
              setActiveWordIndex(i);
              break;
            }
          }
        }
      };

      utterance.onend = () => {
        if (isCancelled) return;
        setActiveWordIndex(-1);
        if (activeSceneIndex < scenes.length - 1) {
          setActiveSceneIndex((prev) => prev + 1);
        } else {
          setActiveSceneIndex(0);
        }
      };

      utterance.onerror = () => {
        if (isCancelled) return;
        setActiveWordIndex(-1);
        if (activeSceneIndex < scenes.length - 1) {
          setActiveSceneIndex((prev) => prev + 1);
        } else {
          setActiveSceneIndex(0);
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    audio.onplay = () => {
      if (isCancelled) return;
      const totalWords = sceneWords.length;
      if (totalWords > 0) {
        // Estimate word duration
        const estimatedDuration = audio.duration && !isNaN(audio.duration) && audio.duration > 0
          ? audio.duration
          : Math.max(2.5, currentText.length * 0.08);

        const intervalMs = Math.max(100, (estimatedDuration * 1000) / (totalWords * speechRate));
        let wIdx = 0;
        setActiveWordIndex(0);

        if (wordInterval) clearInterval(wordInterval);
        wordInterval = setInterval(() => {
          wIdx++;
          if (wIdx < totalWords) {
            setActiveWordIndex(wIdx);
          } else {
            clearInterval(wordInterval);
          }
        }, intervalMs);
      }
    };

    audio.onended = () => {
      if (isCancelled) return;
      if (wordInterval) clearInterval(wordInterval);
      setActiveWordIndex(-1);
      if (activeSceneIndex < scenes.length - 1) {
        setActiveSceneIndex((prev) => prev + 1);
      } else {
        setActiveSceneIndex(0);
      }
    };

    audio.onerror = () => {
      if (isCancelled) return;
      console.log('Server TTS audio failed/cooldown, switching to browser Turkish SpeechSynthesis...');
      startSpeechSynthesisFallback();
    };

    audio.play().catch(() => {
      if (isCancelled) return;
      startSpeechSynthesisFallback();
    });

    return () => {
      isCancelled = true;
      if (wordInterval) clearInterval(wordInterval);
      audio.pause();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeSceneIndex, isPlaying, isMuted, currentText, isTurkish, language, speechRate, selectedVoice]);

  // Sync video play/pause
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, activeSceneIndex, currentScene?.video_url]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleLike = () => {
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      {/* 9:16 Portrait Container Frame */}
      <div className="relative w-full max-w-[310px] sm:max-w-[350px] aspect-[9/16] max-h-[75vh] sm:max-h-[630px] bg-black rounded-[32px] sm:rounded-[36px] overflow-hidden border-4 border-slate-800 shadow-2xl shadow-red-500/10 flex flex-col justify-between group select-none">
        
        {/* Top Progress / Scene Indicator Bar */}
        <div className="absolute top-3 left-3 right-3 z-20 flex space-x-1.5">
          {scenes.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setActiveSceneIndex(idx)}
              className="h-1 flex-1 rounded-full cursor-pointer overflow-hidden bg-white/30 backdrop-blur-sm min-h-[12px] flex items-center"
            >
              <div
                className={`h-1 bg-red-500 transition-all duration-300 ${
                  idx === activeSceneIndex
                    ? 'w-full'
                    : idx < activeSceneIndex
                    ? 'w-full bg-white/80'
                    : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Top Header Overlay */}
        <div className="absolute top-6 left-4 right-4 z-20 flex items-center justify-between text-white text-xs font-semibold drop-shadow-md">
          <span className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px]">
            <Sparkles className="w-3 h-3 text-red-400" /> Shorts AI
          </span>
          <span className="bg-red-600/80 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            9:16 HD
          </span>
        </div>

        {/* Video Background Layer */}
        <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center">
          {currentScene?.video_url ? (
            <video
              ref={videoRef}
              src={currentScene.video_url}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-3 animate-pulse">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <p className="text-xs text-slate-300 font-medium">Stok Video Yükleniyor...</p>
            </div>
          )}

          {/* Vignette & Gradient Overlays for readable text */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
        </div>

        {/* Center Big Play/Pause Touch Overlay */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
        >
          {!isPlaying && (
            <div className="p-3.5 sm:p-4 bg-black/50 backdrop-blur-md rounded-full border border-white/20 shadow-xl transform scale-105 active:scale-95 transition">
              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white translate-x-0.5" />
            </div>
          )}
        </button>

        {/* Right Action Sidebar (YouTube Shorts Style) */}
        <div className="absolute right-2.5 bottom-16 sm:bottom-20 z-20 flex flex-col items-center space-y-3.5 sm:space-y-4 text-white">
          <button
            onClick={toggleLike}
            className="flex flex-col items-center space-y-1 group cursor-pointer"
          >
            <div className={`p-2 sm:p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 group-hover:scale-110 active:scale-95 transition ${liked ? 'text-red-500 bg-red-500/20' : 'text-white'}`}>
              <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${liked ? 'fill-red-500' : ''}`} />
            </div>
            <span className="text-[10px] font-bold drop-shadow">
              {(likeCount / 1000).toFixed(1)}k
            </span>
          </button>

          <button className="flex flex-col items-center space-y-1 group cursor-pointer">
            <div className="p-2 sm:p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 group-hover:scale-110 active:scale-95 transition text-white">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">842</span>
          </button>

          <button className="flex flex-col items-center space-y-1 group cursor-pointer">
            <div className="p-2 sm:p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 group-hover:scale-110 active:scale-95 transition text-white">
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">Paylaş</span>
          </button>

          {/* Audio Disc Spinner */}
          <div className="pt-1">
            <div className={`p-1.5 sm:p-2 rounded-full bg-slate-900 border-2 border-slate-700 shadow-md ${isPlaying ? 'animate-spin' : ''}`}>
              <Disc className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* Bottom Subtitles & Channel Overlay */}
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-12 sm:right-14 z-20 space-y-2.5 text-white pointer-events-none">
          
          {/* Karaoke Subtitles Banner - 5 Words Synchronized Chunk */}
          <div className="bg-black/75 backdrop-blur-md border border-white/15 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-xl min-h-[52px] sm:min-h-[60px] flex items-center justify-center transition-all duration-200">
            <p
              className="text-sm sm:text-base font-black leading-snug tracking-wide text-center"
              lang={isTurkish ? 'tr' : 'en'}
            >
              {(() => {
                const CHUNK_SIZE = 5;
                const currentChunkIndex = activeWordIndex >= 0 ? Math.floor(activeWordIndex / CHUNK_SIZE) : 0;
                const chunkStart = currentChunkIndex * CHUNK_SIZE;
                const chunkEnd = Math.min(sceneWords.length, chunkStart + CHUNK_SIZE);
                const visibleWords = sceneWords.slice(chunkStart, chunkEnd);

                return visibleWords.map((word, relIdx) => {
                  const actualWordIdx = chunkStart + relIdx;
                  const isHighlight = actualWordIdx === activeWordIndex;
                  const formattedWord = isTurkish
                    ? word.toLocaleUpperCase('tr-TR')
                    : word.toLocaleUpperCase('en-US');

                  return (
                    <span
                      key={actualWordIdx}
                      className={`inline-block px-1.5 py-0.5 my-0.5 rounded transition-all duration-150 ${
                        isHighlight
                          ? 'bg-amber-400 text-black scale-105 shadow-md font-black tracking-wider'
                          : 'text-white drop-shadow-md font-extrabold'
                      }`}
                    >
                      {formattedWord}{' '}
                    </span>
                  );
                });
              })()}
            </p>
          </div>

          {/* Channel Name & Sound Info */}
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-bold text-[10px] sm:text-xs text-white shadow-md border border-white/20">
              YT
            </div>
            <span className="text-[11px] sm:text-xs font-bold drop-shadow">@AIGenerator</span>
            <button className="bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow pointer-events-auto">
              Abone Ol
            </button>
          </div>

          <p className="text-[10px] sm:text-[11px] text-slate-200 font-medium truncate drop-shadow flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Orijinal Ses - {selectedVoice} AI Voice</span>
          </p>
        </div>
      </div>

      {/* External Player Control Toolbar */}
      <div className="mt-3 sm:mt-4 flex items-center justify-center space-x-2 sm:space-x-3 bg-slate-900 border border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-lg w-full max-w-[350px]">
        <button
          onClick={() => setActiveSceneIndex((prev) => Math.max(0, prev - 1))}
          disabled={activeSceneIndex === 0}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 active:scale-95 transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
          title="Önceki Sahne"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 shadow-md active:scale-95 transition cursor-pointer min-h-[40px]"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>Durdur</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Oynat</span>
            </>
          )}
        </button>

        <button
          onClick={() => setActiveSceneIndex((prev) => Math.min(scenes.length - 1, prev + 1))}
          disabled={activeSceneIndex === scenes.length - 1}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 active:scale-95 transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
          title="Sonraki Sahne"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800" />

        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2 sm:p-2.5 rounded-xl border active:scale-95 transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer ${
            isMuted
              ? 'bg-red-950/60 border-red-500/50 text-red-400'
              : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

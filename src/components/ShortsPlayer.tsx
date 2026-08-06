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

  const currentScene = scenes[activeSceneIndex] || scenes[0];
  const currentText = currentScene?.text || '';
  const isTurkish = language === 'tr' || /[çğışöüÇĞİŞÖÜ]/.test(currentText);
  const sceneWords = currentText.trim() ? currentText.trim().split(/\s+/) : [];

  // Web Speech Synthesis handler for realistic voiceover audio playback
  useEffect(() => {
    if (!isPlaying || !currentScene || isMuted || !currentText) {
      window.speechSynthesis.cancel();
      setActiveWordIndex(-1);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(currentText);
    utterance.rate = speechRate;
    utterance.lang = isTurkish ? 'tr-TR' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : 'en-US';

    // Pick voice if matches
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      let match = null;
      if (isTurkish) {
        match = voices.find((v) => v.lang.startsWith('tr') || v.name.toLowerCase().includes('turkish'));
      }
      if (!match) {
        match = voices.find(
          (v) =>
            v.name.toLowerCase().includes(selectedVoice.toLowerCase()) ||
            v.lang.startsWith(language)
        );
      }
      if (match) utterance.voice = match;
    }

    // Word boundary tracking for karaoke subtitle highlight
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
      setActiveWordIndex(-1);
      // Automatically advance to next scene
      if (activeSceneIndex < scenes.length - 1) {
        setActiveSceneIndex((prev) => prev + 1);
      } else {
        // Loop back to start
        setActiveSceneIndex(0);
      }
    };

    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [activeSceneIndex, isPlaying, isMuted, selectedVoice, speechRate, currentText, isTurkish, language]);

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
    <div className="flex flex-col items-center">
      {/* 9:16 Portrait Container Frame */}
      <div className="relative w-[310px] sm:w-[350px] h-[580px] sm:h-[630px] bg-black rounded-[36px] overflow-hidden border-4 border-slate-800 shadow-2xl shadow-red-500/10 flex flex-col justify-between group select-none">
        
        {/* Top Progress / Scene Indicator Bar */}
        <div className="absolute top-3 left-3 right-3 z-20 flex space-x-1.5">
          {scenes.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setActiveSceneIndex(idx)}
              className="h-1 flex-1 rounded-full cursor-pointer overflow-hidden bg-white/30 backdrop-blur-sm"
            >
              <div
                className={`h-full bg-red-500 transition-all duration-300 ${
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
          <span className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
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
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-3 animate-pulse">
                <Sparkles className="w-8 h-8" />
              </div>
              <p className="text-xs text-slate-300 font-medium">Loading Stock Scene Video...</p>
            </div>
          )}

          {/* Vignette & Gradient Overlays for readable text */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
        </div>

        {/* Center Big Play/Pause Touch Overlay */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center text-white/80 hover:text-white transition"
        >
          {!isPlaying && (
            <div className="p-4 bg-black/50 backdrop-blur-md rounded-full border border-white/20 shadow-xl transform scale-110">
              <Play className="w-10 h-10 fill-white translate-x-0.5" />
            </div>
          )}
        </button>

        {/* Right Action Sidebar (YouTube Shorts Style) */}
        <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center space-y-4 text-white">
          <button
            onClick={toggleLike}
            className="flex flex-col items-center space-y-1 group"
          >
            <div className={`p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 group-hover:scale-110 transition ${liked ? 'text-red-500 bg-red-500/20' : 'text-white'}`}>
              <Heart className={`w-5 h-5 ${liked ? 'fill-red-500' : ''}`} />
            </div>
            <span className="text-[10px] font-bold drop-shadow">
              {(likeCount / 1000).toFixed(1)}k
            </span>
          </button>

          <button className="flex flex-col items-center space-y-1 group">
            <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 group-hover:scale-110 transition text-white">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">842</span>
          </button>

          <button className="flex flex-col items-center space-y-1 group">
            <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 group-hover:scale-110 transition text-white">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">Share</span>
          </button>

          {/* Audio Disc Spinner */}
          <div className="pt-2">
            <div className={`p-2 rounded-full bg-slate-900 border-2 border-slate-700 shadow-md ${isPlaying ? 'animate-spin' : ''}`}>
              <Disc className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* Bottom Subtitles & Channel Overlay */}
        <div className="absolute bottom-4 left-4 right-14 z-20 space-y-3 text-white pointer-events-none">
          
          {/* Karaoke Subtitles Banner */}
          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl">
            <p
              className="text-xs sm:text-sm font-black leading-snug tracking-wide text-center"
              lang={isTurkish ? 'tr' : 'en'}
            >
              {sceneWords.map((word, wIdx) => {
                const isHighlight = wIdx === activeWordIndex;
                const formattedWord = isTurkish
                  ? word.toLocaleUpperCase('tr-TR')
                  : word.toLocaleUpperCase('en-US');

                return (
                  <span
                    key={wIdx}
                    className={`inline-block px-1 py-0.5 my-0.5 rounded transition-all duration-150 ${
                      isHighlight
                        ? 'bg-amber-400 text-black scale-105 shadow-md font-bold'
                        : 'text-white drop-shadow-md'
                    }`}
                  >
                    {formattedWord}{' '}
                  </span>
                );
              })}
            </p>
          </div>

          {/* Channel Name & Sound Info */}
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-bold text-xs text-white shadow-md border border-white/20">
              YT
            </div>
            <span className="text-xs font-bold drop-shadow">@AIGenerator</span>
            <button className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow">
              Subscribe
            </button>
          </div>

          <p className="text-[11px] text-slate-200 font-medium truncate drop-shadow flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Original Sound - {selectedVoice} AI Voice</span>
          </p>
        </div>
      </div>

      {/* External Player Control Toolbar */}
      <div className="mt-4 flex items-center space-x-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl shadow-lg">
        <button
          onClick={() => setActiveSceneIndex((prev) => Math.max(0, prev - 1))}
          disabled={activeSceneIndex === 0}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 transition"
          title="Previous Scene"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md transition"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Play Short</span>
            </>
          )}
        </button>

        <button
          onClick={() => setActiveSceneIndex((prev) => Math.min(scenes.length - 1, prev + 1))}
          disabled={activeSceneIndex === scenes.length - 1}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 transition"
          title="Next Scene"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800" />

        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2 rounded-xl border transition ${
            isMuted
              ? 'bg-red-950/60 border-red-500/50 text-red-400'
              : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

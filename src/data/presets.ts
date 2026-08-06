import { PresetTopic, VoiceOption } from '../types';

export const PRESET_TOPICS: PresetTopic[] = [
  {
    title: 'Evrenin en gizemli 5 kara deliği',
    category: 'Astronomy',
    icon: '🌌',
    language: 'tr',
  },
  {
    title: '5 Mind-Blowing Facts About Deep Ocean',
    category: 'Nature',
    icon: '🌊',
    language: 'en',
  },
  {
    title: 'Ancient Secrets of the Egyptian Pyramids',
    category: 'History',
    icon: '🏛️',
    language: 'en',
  },
  {
    title: 'Yapay Zeka Dünyayı Nasıl Değiştirecek?',
    category: 'Technology',
    icon: '🤖',
    language: 'tr',
  },
  {
    title: 'Top 5 Most Mysterious Places on Earth',
    category: 'Geographic',
    icon: '🗺️',
    language: 'en',
  },
];

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Puck', name: 'Puck (Deep Energetic)', gender: 'male', style: 'Dynamic' },
  { id: 'Charon', name: 'Charon (Narrator)', gender: 'male', style: 'Documentary' },
  { id: 'Kore', name: 'Kore (Clear & Crisp)', gender: 'female', style: 'Modern' },
  { id: 'Fenrir', name: 'Fenrir (Bold & Powerful)', gender: 'male', style: 'Trailer' },
  { id: 'Aoede', name: 'Aoede (Smooth & Calm)', gender: 'female', style: 'Storytelling' },
];

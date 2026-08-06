export interface Scene {
  scene: number;
  text: string;
  visual_query: string;
  video_url?: string;
  video_thumbnail?: string;
  duration?: number;
}

export interface ShortScript {
  id: string;
  topic: string;
  language: string;
  scenes: Scene[];
  generated_at: string;
  voice_name?: string;
}

export interface PexelsVideoResult {
  id: number;
  url: string;
  image: string;
  duration: number;
  video_files: {
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }[];
}

export interface PresetTopic {
  title: string;
  category: string;
  icon: string;
  language: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  style: string;
}

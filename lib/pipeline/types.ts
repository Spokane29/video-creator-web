export interface Scene {
  scene_number: number;
  description: string;
  dialogue: string;
  motion_description?: string;
  motion_prompt?: string;
  narration?: string;
  image_prompt?: string;
}

export interface Script {
  title: string;
  scenes: Scene[];
}

export interface JobStatus {
  jobId: string;
  stage: string;
  progress: number;
  message: string;
  files: {
    script?: string;
    images?: string[];
    videos?: string[];
    audio?: string[];
    final?: string;
  };
  error?: string;
  script?: Script;
}

export interface GenerationParams {
  prompt: string;
  template: string;
  mode: 'ai' | 'real';
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3';
  scenes: number;
  duration: number;
  voice: string;
}

export interface Template {
  name: string;
  description: string;
  style: string;
  tone: string;
  default_character?: string;
  scene_structure: {
    intro: string;
    tips?: string;
    outro: string;
  };
}

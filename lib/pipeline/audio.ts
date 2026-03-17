import { Scene } from './types';
import fs from 'fs/promises';
import path from 'path';

const FAL_KEY = process.env.FAL_KEY;

// Map voice names to Kokoro voices
const VOICE_MAPPING: Record<string, string> = {
  'nova': 'af_heart',      // Female, warm
  'alloy': 'af_bella',     // Female, professional
  'echo': 'am_adam',       // Male, deep
  'fable': 'am_michael',   // Male, narrator
  'onyx': 'am_eric',       // Male, authoritative
  'shimmer': 'af_sarah',   // Female, bright
};

export async function generateAudio(text: string, voice: string): Promise<Buffer> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  const kokoroVoice = VOICE_MAPPING[voice] || 'af_heart';

  const res = await fetch('https://fal.run/fal-ai/kokoro/american-english', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice: kokoroVoice,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Audio generation failed: ${err}`);
  }

  const data = await res.json();
  const audioUrl = data.audio_url || data.audio?.url;
  if (!audioUrl) throw new Error('No audio URL in response');

  // Download the audio
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error('Failed to download audio');
  return Buffer.from(await audioRes.arrayBuffer());
}

export async function generateSingleAudio(
  text: string,
  voice: string,
  jobDir: string,
  sceneIndex: number
): Promise<string> {
  const audioBuffer = await generateAudio(text, voice);
  const filename = `scene_${sceneIndex + 1}.mp3`;
  await fs.writeFile(path.join(jobDir, filename), audioBuffer);
  return filename;
}

export async function generateAllAudio(
  scenes: Scene[],
  voice: string,
  jobDir: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const audioPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const audioBuffer = await generateAudio(scene.dialogue || scene.narration || '', voice);

    const filename = `scene_${i + 1}.mp3`;
    await fs.writeFile(path.join(jobDir, filename), audioBuffer);
    audioPaths.push(filename);

    if (onProgress) onProgress(i + 1, scenes.length);
  }

  return audioPaths;
}

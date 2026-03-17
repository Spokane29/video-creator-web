import { Scene } from './types';
import fs from 'fs/promises';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TTS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

const VOICE_MAPPING: Record<string, string> = {
  'nova': 'Kore',
  'alloy': 'Aoede',
  'echo': 'Charon',
  'fable': 'Fenrir',
  'onyx': 'Puck',
  'shimmer': 'Leda',
};

export async function generateAudio(text: string, voice: string): Promise<Buffer> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const geminiVoice = VOICE_MAPPING[voice] || 'Kore';

  const payload = {
    contents: [{
      parts: [{ text }]
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: geminiVoice
          }
        }
      }
    }
  };

  const response = await fetch(`${TTS_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Audio generation failed: ${error}`);
  }

  const data = await response.json();
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioBase64) {
    throw new Error('No audio data in response');
  }

  return Buffer.from(audioBase64, 'base64');
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
    const audioBuffer = await generateAudio(scene.dialogue, voice);

    const filename = `scene_${i + 1}.mp3`;
    const filepath = path.join(jobDir, filename);
    await fs.writeFile(filepath, audioBuffer);

    audioPaths.push(filename);

    if (onProgress) {
      onProgress(i + 1, scenes.length);
    }
  }

  return audioPaths;
}

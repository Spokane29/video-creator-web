import { Scene } from './types';
import fs from 'fs/promises';
import path from 'path';

const FAL_KEY = process.env.FAL_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Fallback

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitFalVideo(imageUrl: string, motionPrompt: string, duration: number): Promise<string> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  // fal.ai queue submit
  const res = await fetch('https://fal.run/wan/v2.6/image-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: motionPrompt,
      image_url: imageUrl,
      duration: duration <= 5 ? '5s' : duration <= 10 ? '10s' : '15s',
      resolution: '720p',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`fal.ai video generation failed: ${err}`);
  }

  const data = await res.json();
  
  // fal.run returns the result directly (synchronous endpoint)
  if (data.video?.url) {
    return data.video.url;
  }
  
  throw new Error('No video URL in fal.ai response');
}

async function uploadImageToFal(imageBase64: string): Promise<string> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  // Upload image to fal.ai storage
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  const res = await fetch('https://fal.ai/api/storage/upload/base64', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_name: 'scene.png',
      content_type: 'image/png',
      data: imageBase64,
    }),
  });

  if (!res.ok) {
    // Fallback: use data URI
    return `data:image/png;base64,${imageBase64}`;
  }

  const data = await res.json();
  return data.url || data.file_url || `data:image/png;base64,${imageBase64}`;
}

export async function generateSingleVideo(
  imageBase64: string,
  motionPrompt: string,
  duration: number,
  jobDir: string,
  sceneIndex: number
): Promise<string> {
  if (duration < 5) duration = 5;
  if (duration > 8) duration = 5; // Wan supports 5, 10, 15 — use 5 for short scenes

  // Upload image to get a URL
  const imageUrl = await uploadImageToFal(imageBase64);

  // Generate video
  const videoUrl = await submitFalVideo(imageUrl, motionPrompt, duration);

  // Download the video
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error('Failed to download video from fal.ai');
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

  const filename = `scene_${sceneIndex + 1}.mp4`;
  await fs.writeFile(path.join(jobDir, filename), videoBuffer);
  return filename;
}

export async function generateAllVideos(
  scenes: Scene[],
  jobDir: string,
  duration: number,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const videoPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const imagePath = path.join(jobDir, `scene_${i + 1}.png`);
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    const filename = await generateSingleVideo(
      imageBase64,
      scenes[i].motion_prompt || scenes[i].motion_description || 'gentle smooth animation',
      duration,
      jobDir,
      i
    );
    videoPaths.push(filename);

    if (onProgress) onProgress(i + 1, scenes.length);

    // Small cooldown between scenes (fal.ai is more lenient)
    if (i < scenes.length - 1) {
      await sleep(5000);
    }
  }

  return videoPaths;
}

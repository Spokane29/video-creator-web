import { Scene } from './types';
import fs from 'fs/promises';
import path from 'path';

const FAL_KEY = process.env.FAL_KEY;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitFalVideo(imageUrl: string, motionPrompt: string, duration: number): Promise<string> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  const res = await fetch('https://fal.run/wan/v2.6/image-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: motionPrompt,
      image_url: imageUrl,
      duration: duration <= 5 ? '5' : duration <= 10 ? '10' : '15',
      resolution: '720p',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`fal.ai video generation failed: ${err}`);
  }

  const data = await res.json();
  
  if (data.video?.url) {
    return data.video.url;
  }
  
  throw new Error('No video URL in fal.ai response');
}

async function uploadImageToFal(imageBase64: string): Promise<string> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  // Use fal.ai's REST file upload
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  const res = await fetch('https://fal.ai/api/storage/upload', {
    method: 'PUT',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'image/png',
    },
    body: imageBuffer,
  });

  if (res.ok) {
    const data = await res.json();
    if (data.url) return data.url;
  }

  // Fallback: try the REST upload endpoint
  const res2 = await fetch('https://rest.alpha.fal.ai/storage/upload', {
    method: 'PUT',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'image/png',
    },
    body: imageBuffer,
  });

  if (res2.ok) {
    const data2 = await res2.json();
    if (data2.url) return data2.url;
  }

  throw new Error('Failed to upload image to fal.ai storage');
}

export async function generateSingleVideo(
  imageSource: string,
  motionPrompt: string,
  duration: number,
  jobDir: string,
  sceneIndex: number,
  isUrl: boolean = false
): Promise<string> {
  if (duration < 5) duration = 5;
  if (duration > 8) duration = 5;

  let imageUrl: string;
  
  if (isUrl) {
    // Already a CDN URL from fal.ai Flux generation
    imageUrl = imageSource;
  } else {
    // Base64 data — upload to fal.ai storage first
    imageUrl = await uploadImageToFal(imageSource);
  }

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
  imageUrls?: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const videoPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const url = imageUrls?.[i];
    let imgBase64: string | undefined;
    
    if (!url) {
      const imagePath = path.join(jobDir, `scene_${i + 1}.png`);
      const imageBuffer = await fs.readFile(imagePath);
      imgBase64 = imageBuffer.toString('base64');
    }

    const filename = await generateSingleVideo(
      url || imgBase64!,
      scenes[i].motion_prompt || scenes[i].motion_description || 'gentle smooth animation',
      duration,
      jobDir,
      i,
      !!url
    );
    videoPaths.push(filename);

    if (onProgress) onProgress(i + 1, scenes.length);

    if (i < scenes.length - 1) {
      await sleep(5000);
    }
  }

  return videoPaths;
}

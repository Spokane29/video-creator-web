import { Scene } from './types';
import fs from 'fs/promises';
import path from 'path';

const FAL_KEY = process.env.FAL_KEY;

const ASPECT_TO_FAL: Record<string, string> = {
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '1:1': 'square',
  '4:3': 'landscape_4_3',
};

async function generateImageWithFlux(
  prompt: string,
  aspectRatio: string,
  styleReference?: string
): Promise<Buffer> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  const falAspect = ASPECT_TO_FAL[aspectRatio] || 'landscape_16_9';

  const payload: any = {
    prompt,
    image_size: falAspect,
    num_images: 1,
  };

  // Use Flux Dev for better quality, Schnell for speed
  const model = 'fal-ai/flux/dev';

  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation failed: ${err}`);
  }

  const data = await res.json();
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in response');

  // Download the image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('Failed to download image');
  return Buffer.from(await imgRes.arrayBuffer());
}

export async function generateAllImages(
  scenes: Scene[],
  aspectRatio: string,
  jobDir: string,
  styleReference?: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const imagePaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prompt = scene.image_prompt || scene.visual_description || `Scene ${i + 1}`;

    const imageBuffer = await generateImageWithFlux(prompt, aspectRatio, styleReference);

    const filename = `scene_${i + 1}.png`;
    await fs.writeFile(path.join(jobDir, filename), imageBuffer);
    imagePaths.push(filename);

    if (onProgress) onProgress(i + 1, scenes.length);
  }

  return imagePaths;
}

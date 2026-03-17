import { Scene } from './types';
import fs from 'fs/promises';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGEN_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict';

function aspectRatioToImagenFormat(aspectRatio: string): string {
  const mapping: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '4:3',
  };
  return mapping[aspectRatio] || '9:16';
}

export async function generateImage(
  scene: Scene,
  aspectRatio: string,
  styleReference?: string
): Promise<Buffer> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = scene.image_prompt || scene.description;

  const payload: any = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: aspectRatioToImagenFormat(aspectRatio),
    }
  };

  // Add style reference if provided (base64 encoded image)
  if (styleReference) {
    payload.instances[0].styleReferenceImage = {
      bytesBase64Encoded: styleReference,
    };
  }

  const response = await fetch(`${IMAGEN_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Image generation failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
    throw new Error('No image data in response');
  }

  const imageBase64 = data.predictions[0].bytesBase64Encoded;
  return Buffer.from(imageBase64, 'base64');
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
    const imageBuffer = await generateImage(scene, aspectRatio, styleReference);
    
    const filename = `scene_${i + 1}.png`;
    const filepath = path.join(jobDir, filename);
    await fs.writeFile(filepath, imageBuffer);
    
    imagePaths.push(filename);
    
    if (onProgress) {
      onProgress(i + 1, scenes.length);
    }
  }

  return imagePaths;
}

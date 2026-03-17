import { Scene } from './types';
import fs from 'fs/promises';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VEO_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning';
const OPERATIONS_URL = 'https://generativelanguage.googleapis.com/v1beta';

const COOLDOWN_MS = 90000; // 90 seconds between video generations

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollOperation(operationName: string): Promise<any> {
  const url = `${OPERATIONS_URL}/${operationName}?key=${GEMINI_API_KEY}`;
  
  while (true) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Operation polling failed: ${await response.text()}`);
    }
    
    const data = await response.json();
    
    if (data.done) {
      if (data.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(data.error)}`);
      }
      return data;
    }
    
    // Wait 5 seconds before polling again
    await sleep(5000);
  }
}

async function downloadVideo(uri: string): Promise<Buffer> {
  const response = await fetch(`${uri}&key=${GEMINI_API_KEY}`);
  if (!response.ok) {
    throw new Error(`Video download failed: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function generateVideo(
  imageBuffer: Buffer,
  scene: Scene,
  duration: number
): Promise<Buffer> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Ensure duration is within valid range
  if (duration < 5 || duration > 8) {
    throw new Error('Duration must be between 5-8 seconds');
  }

  const imageBase64 = imageBuffer.toString('base64');
  const motionPrompt = scene.motion_description || 'Smooth camera movement, subtle animation';

  const payload = {
    instances: [{
      image: {
        bytesBase64Encoded: imageBase64,
        mimeType: 'image/png'
      },
      prompt: motionPrompt
    }],
    parameters: {
      durationSeconds: duration
    }
  };

  const response = await fetch(`${VEO_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Video generation request failed: ${error}`);
  }

  const data = await response.json();
  const operationName = data.name;

  // Poll for completion
  const result = await pollOperation(operationName);

  // Extract video URI
  const videoUri = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!videoUri) {
    throw new Error('No video URI in response');
  }

  // Download the video
  return await downloadVideo(videoUri);
}

export async function generateSingleVideo(
  imageBase64: string,
  motionPrompt: string,
  duration: number,
  jobDir: string,
  sceneIndex: number
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  if (duration < 5 || duration > 8) duration = 6;

  const payload = {
    instances: [{
      image: { bytesBase64Encoded: imageBase64, mimeType: 'image/png' },
      prompt: motionPrompt
    }],
    parameters: { durationSeconds: duration }
  };

  const response = await fetch(`${VEO_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Veo 2 request failed: ${error}`);
  }

  const data = await response.json();
  const result = await pollOperation(data.name);
  const videoUri = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!videoUri) throw new Error('No video URI in response');

  const videoBuffer = await downloadVideo(videoUri);
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
    // Read the generated image
    const imagePath = path.join(jobDir, `scene_${i + 1}.png`);
    const imageBuffer = await fs.readFile(imagePath);

    // Generate video
    const videoBuffer = await generateVideo(imageBuffer, scenes[i], duration);

    // Save video
    const filename = `scene_${i + 1}.mp4`;
    const filepath = path.join(jobDir, filename);
    await fs.writeFile(filepath, videoBuffer);

    videoPaths.push(filename);

    if (onProgress) {
      onProgress(i + 1, scenes.length);
    }

    // Apply cooldown between scenes (except after last scene)
    if (i < scenes.length - 1) {
      console.log(`Cooldown: waiting ${COOLDOWN_MS / 1000} seconds before next video...`);
      await sleep(COOLDOWN_MS);
    }
  }

  return videoPaths;
}

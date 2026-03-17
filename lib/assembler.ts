// Client-side video assembly using ffmpeg.wasm
// Merges video clips + audio tracks into one final video

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  
  // Load ffmpeg.wasm from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function assembleVideo(
  videoUrls: string[],
  audioUrls: string[],
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('Loading video editor...');
  const ffmpeg = await getFFmpeg();

  // Download all video and audio files
  for (let i = 0; i < videoUrls.length; i++) {
    onProgress?.(`Downloading scene ${i + 1} video...`);
    const videoData = await fetchFile(videoUrls[i]);
    await ffmpeg.writeFile(`video_${i}.mp4`, videoData);

    if (audioUrls[i]) {
      onProgress?.(`Downloading scene ${i + 1} audio...`);
      const audioData = await fetchFile(audioUrls[i]);
      // Kokoro TTS returns WAV
      const ext = audioUrls[i].includes('.wav') ? 'wav' : 'mp3';
      await ffmpeg.writeFile(`audio_${i}.${ext}`, audioData);
    }
  }

  // Step 1: Merge audio onto each video clip
  const mergedFiles: string[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    onProgress?.(`Combining scene ${i + 1} video + voice...`);
    const audioExt = audioUrls[i]?.includes('.wav') ? 'wav' : 'mp3';
    
    if (audioUrls[i]) {
      await ffmpeg.exec([
        '-i', `video_${i}.mp4`,
        '-i', `audio_${i}.${audioExt}`,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-y', `merged_${i}.mp4`
      ]);
    } else {
      // No audio — just copy video
      await ffmpeg.exec([
        '-i', `video_${i}.mp4`,
        '-c', 'copy',
        '-y', `merged_${i}.mp4`
      ]);
    }
    mergedFiles.push(`merged_${i}.mp4`);
  }

  // Step 2: Re-encode all to consistent format for concatenation
  for (let i = 0; i < mergedFiles.length; i++) {
    onProgress?.(`Normalizing scene ${i + 1}...`);
    await ffmpeg.exec([
      '-i', `merged_${i}.mp4`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y', `normalized_${i}.mp4`
    ]);
  }

  // Step 3: Build concat file list
  let concatList = '';
  for (let i = 0; i < mergedFiles.length; i++) {
    concatList += `file 'normalized_${i}.mp4'\n`;
  }
  await ffmpeg.writeFile('concat.txt', concatList);

  // Step 4: Concatenate all scenes
  onProgress?.('Assembling final video...');
  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-movflags', '+faststart',
    '-y', 'final.mp4'
  ]);

  // Read result
  const data = await ffmpeg.readFile('final.mp4');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([data as any], { type: 'video/mp4' });

  // Cleanup
  for (let i = 0; i < videoUrls.length; i++) {
    try {
      await ffmpeg.deleteFile(`video_${i}.mp4`);
      await ffmpeg.deleteFile(`audio_${i}.mp3`);
      await ffmpeg.deleteFile(`audio_${i}.wav`);
      await ffmpeg.deleteFile(`merged_${i}.mp4`);
      await ffmpeg.deleteFile(`normalized_${i}.mp4`);
    } catch {}
  }
  try {
    await ffmpeg.deleteFile('concat.txt');
    await ffmpeg.deleteFile('final.mp4');
  } catch {}

  onProgress?.('Done!');
  return blob;
}

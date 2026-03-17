import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJob, updateJob, ensureJobDir, saveToHistory } from '@/lib/jobs';
import { generateAllImages } from '@/lib/pipeline/images';
import { generateSingleVideo } from '@/lib/pipeline/video';
import { generateSingleAudio } from '@/lib/pipeline/audio';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300; // 5 min max for Pro plan, 60s for hobby

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;
    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobDir = await ensureJobDir(jobId);
    
    // Load params and script
    let jobParams: any = {};
    let script: any = null;
    try {
      const paramsData = await fs.readFile(path.join(jobDir, 'params.json'), 'utf-8');
      jobParams = JSON.parse(paramsData);
    } catch {}
    try {
      const scriptData = await fs.readFile(path.join(jobDir, 'script.json'), 'utf-8');
      script = JSON.parse(scriptData);
    } catch {}

    const stage = job.stage;

    // Route to next stage
    if (stage === 'script_done') {
      return await handleImages(jobId, jobDir, jobParams, script);
    } else if (stage === 'images_done') {
      return await handleVideo(jobId, jobDir, jobParams, script, 0);
    } else if (stage?.startsWith('video_')) {
      // video_0_done, video_1_done, etc.
      const match = stage.match(/video_(\d+)_done/);
      if (match) {
        const completedIndex = parseInt(match[1]);
        const nextIndex = completedIndex + 1;
        if (nextIndex < (script?.scenes?.length || 0)) {
          return await handleVideo(jobId, jobDir, jobParams, script, nextIndex);
        } else {
          // All videos done, move to audio
          updateJob(jobId, { stage: 'videos_done', progress: 70, message: 'All videos generated!' });
          return NextResponse.json({ status: 'videos_done', next: 'audio' });
        }
      }
    } else if (stage === 'videos_done') {
      return await handleAudio(jobId, jobDir, jobParams, script, 0);
    } else if (stage?.startsWith('audio_')) {
      const match = stage.match(/audio_(\d+)_done/);
      if (match) {
        const completedIndex = parseInt(match[1]);
        const nextIndex = completedIndex + 1;
        if (nextIndex < (script?.scenes?.length || 0)) {
          return await handleAudio(jobId, jobDir, jobParams, script, nextIndex);
        } else {
          // All audio done — complete!
          updateJob(jobId, {
            stage: 'complete',
            progress: 100,
            message: 'Generation complete! All scene clips ready.',
          });
          const finalJob = getJob(jobId);
          if (finalJob) await saveToHistory(finalJob);
          return NextResponse.json({ status: 'complete' });
        }
      }
    } else if (stage === 'complete' || stage === 'error') {
      return NextResponse.json({ status: stage, message: job.message });
    }

    return NextResponse.json({ status: stage, message: 'Waiting...' });
  } catch (error: any) {
    console.error('Pipeline step error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleImages(jobId: string, jobDir: string, params: any, script: any) {
  updateJob(jobId, { stage: 'images', progress: 25, message: 'Generating images...' });

  try {
    if (params.mode === 'real') {
      // Photos already uploaded during generate step
      const files = await fs.readdir(jobDir);
      const sceneFiles = files.filter(f => f.startsWith('scene_') && f.endsWith('.png')).sort();
      updateJob(jobId, {
        stage: 'images_done',
        progress: 40,
        message: `Using ${sceneFiles.length} uploaded photos`,
        files: { images: sceneFiles },
      });
      return NextResponse.json({ status: 'images_done', images: sceneFiles });
    }

    // AI mode: generate all images (fast, ~5-10s each)
    let styleRef: string | undefined;
    try {
      const refBuffer = await fs.readFile(path.join(jobDir, 'style_reference.png'));
      styleRef = refBuffer.toString('base64');
    } catch {}

    const { filenames: imagePaths } = await generateAllImages(
      script.scenes,
      params.aspect_ratio || '9:16',
      jobDir,
      styleRef,
      (current: number, total: number) => {
        updateJob(jobId, {
          progress: 25 + (current / total) * 15,
          message: `Generated ${current}/${total} images...`,
        });
      }
    );

    updateJob(jobId, {
      stage: 'images_done',
      progress: 40,
      message: 'All images generated!',
      files: { images: imagePaths },
    });

    return NextResponse.json({ status: 'images_done', images: imagePaths });
  } catch (err: any) {
    updateJob(jobId, { stage: 'error', progress: 0, message: `Image generation failed: ${err.message}`, error: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleVideo(jobId: string, jobDir: string, params: any, script: any, sceneIndex: number) {
  const scene = script.scenes[sceneIndex];
  const total = script.scenes.length;
  
  updateJob(jobId, {
    stage: `video_${sceneIndex}`,
    progress: 45 + (sceneIndex / total) * 25,
    message: `Generating video ${sceneIndex + 1}/${total}...`,
  });

  try {
    const imagePath = path.join(jobDir, `scene_${sceneIndex + 1}.png`);
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    const videoPath = await generateSingleVideo(
      imageBase64,
      scene.motion_prompt || scene.image_prompt || 'gentle animation',
      params.duration || 6,
      jobDir,
      sceneIndex
    );

    updateJob(jobId, {
      stage: `video_${sceneIndex}_done`,
      progress: 45 + ((sceneIndex + 1) / total) * 25,
      message: `Video ${sceneIndex + 1}/${total} complete!`,
    });

    return NextResponse.json({ status: `video_${sceneIndex}_done`, videoPath });
  } catch (err: any) {
    updateJob(jobId, { stage: 'error', progress: 0, message: `Video ${sceneIndex + 1} failed: ${err.message}`, error: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleAudio(jobId: string, jobDir: string, params: any, script: any, sceneIndex: number) {
  const scene = script.scenes[sceneIndex];
  const total = script.scenes.length;

  updateJob(jobId, {
    stage: `audio_${sceneIndex}`,
    progress: 75 + (sceneIndex / total) * 15,
    message: `Generating audio ${sceneIndex + 1}/${total}...`,
  });

  try {
    const audioPath = await generateSingleAudio(
      scene.dialogue || scene.narration || '',
      params.voice || 'nova',
      jobDir,
      sceneIndex
    );

    updateJob(jobId, {
      stage: `audio_${sceneIndex}_done`,
      progress: 75 + ((sceneIndex + 1) / total) * 15,
      message: `Audio ${sceneIndex + 1}/${total} complete!`,
    });

    return NextResponse.json({ status: `audio_${sceneIndex}_done`, audioPath });
  } catch (err: any) {
    updateJob(jobId, { stage: 'error', progress: 0, message: `Audio ${sceneIndex + 1} failed: ${err.message}`, error: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

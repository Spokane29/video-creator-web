import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createJob, updateJob, generateJobId, ensureJobDir, saveToHistory } from '@/lib/jobs';
import { GenerationParams } from '@/lib/pipeline/types';
import { generateScript } from '@/lib/pipeline/script';
import { generateAllImages } from '@/lib/pipeline/images';
import { generateAllVideos } from '@/lib/pipeline/video';
import { generateAllAudio } from '@/lib/pipeline/audio';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();

    const params: GenerationParams = {
      prompt: formData.get('prompt') as string,
      template: formData.get('template') as string,
      mode: formData.get('mode') as 'ai' | 'real',
      aspect_ratio: formData.get('aspect_ratio') as '16:9' | '9:16' | '1:1' | '4:3',
      scenes: parseInt(formData.get('scenes') as string),
      duration: parseInt(formData.get('duration') as string),
      voice: formData.get('voice') as string,
    };

    const jobId = generateJobId();
    const jobDir = await ensureJobDir(jobId);

    // Create job and start pipeline
    createJob(jobId);

    // Run pipeline in background
    runPipeline(jobId, jobDir, params, formData).catch(error => {
      console.error('Pipeline error:', error);
      updateJob(jobId, {
        stage: 'error',
        progress: 100,
        message: error.message,
        error: error.message,
      });
    });

    return NextResponse.json({ jobId });
  } catch (error: any) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    );
  }
}

async function runPipeline(
  jobId: string,
  jobDir: string,
  params: GenerationParams,
  formData: FormData
) {
  try {
    // Stage 1: Script Generation
    updateJob(jobId, {
      stage: 'script',
      progress: 10,
      message: 'Generating script...',
    });

    const script = await generateScript(params);
    
    await fs.writeFile(
      path.join(jobDir, 'script.json'),
      JSON.stringify(script, null, 2)
    );

    updateJob(jobId, {
      progress: 20,
      message: 'Script generated!',
      script,
      files: { script: 'script.json' },
    });

    // Stage 2: Images (or use uploaded photos)
    updateJob(jobId, {
      stage: 'images',
      progress: 25,
      message: params.mode === 'ai' ? 'Generating images...' : 'Processing uploaded photos...',
    });

    let imagePaths: string[] = [];

    if (params.mode === 'ai') {
      // Get style reference if provided
      let styleReference: string | undefined;
      const stylePhoto = formData.get('photo') as File | null;
      if (stylePhoto) {
        const buffer = await stylePhoto.arrayBuffer();
        styleReference = Buffer.from(buffer).toString('base64');
      }

      imagePaths = await generateAllImages(
        script.scenes,
        params.aspect_ratio,
        jobDir,
        styleReference,
        (current, total) => {
          const progress = 25 + (current / total) * 15;
          updateJob(jobId, {
            progress,
            message: `Generated ${current}/${total} images...`,
          });
        }
      );
    } else {
      // Handle uploaded scene photos
      const scenePhotos = formData.getAll('scene_photos') as File[];
      for (let i = 0; i < scenePhotos.length && i < script.scenes.length; i++) {
        const photo = scenePhotos[i];
        const buffer = await photo.arrayBuffer();
        const filename = `scene_${i + 1}.png`;
        await fs.writeFile(path.join(jobDir, filename), Buffer.from(buffer));
        imagePaths.push(filename);
      }
    }

    updateJob(jobId, {
      progress: 40,
      message: 'Images ready!',
      files: { script: 'script.json', images: imagePaths },
    });

    // Stage 3: Video Animation
    updateJob(jobId, {
      stage: 'videos',
      progress: 45,
      message: 'Generating videos (this may take a while)...',
    });

    const videoPaths = await generateAllVideos(
      script.scenes,
      jobDir,
      params.duration,
      (current, total) => {
        const progress = 45 + (current / total) * 25;
        updateJob(jobId, {
          progress,
          message: `Generated ${current}/${total} videos... (90s cooldown between scenes)`,
        });
      }
    );

    updateJob(jobId, {
      progress: 70,
      message: 'Videos generated!',
      files: { script: 'script.json', images: imagePaths, videos: videoPaths },
    });

    // Stage 4: Audio
    updateJob(jobId, {
      stage: 'audio',
      progress: 75,
      message: 'Generating narration...',
    });

    const audioPaths = await generateAllAudio(
      script.scenes,
      params.voice,
      jobDir,
      (current, total) => {
        const progress = 75 + (current / total) * 15;
        updateJob(jobId, {
          progress,
          message: `Generated ${current}/${total} audio clips...`,
        });
      }
    );

    updateJob(jobId, {
      progress: 90,
      message: 'Narration complete!',
      files: { script: 'script.json', images: imagePaths, videos: videoPaths, audio: audioPaths },
    });

    // Stage 5: Assembly (skip for now - provide individual clips)
    updateJob(jobId, {
      stage: 'complete',
      progress: 100,
      message: 'Generation complete! Individual scene clips are ready for download.',
    });

    // Save to history
    const { getJob } = await import('@/lib/jobs');
    const job = getJob(jobId);
    if (job) {
      await saveToHistory(job);
    }

  } catch (error: any) {
    throw error;
  }
}

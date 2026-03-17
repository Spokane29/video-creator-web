import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateJobId } from '@/lib/jobs';
import { GenerationParams } from '@/lib/pipeline/types';
import { generateScript } from '@/lib/pipeline/script';
import { generateAllImages } from '@/lib/pipeline/images';
import { generateSingleVideo } from '@/lib/pipeline/video';
import { generateSingleAudio } from '@/lib/pipeline/audio';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300; // Request max duration (hobby: 60s, pro: 300s)

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
    const jobDir = path.join('/tmp/video-creator', jobId);
    await fs.mkdir(jobDir, { recursive: true });

    // Handle file uploads
    let styleReference: string | undefined;
    const scenePhotoPaths: string[] = [];

    if (params.mode === 'ai') {
      const photo = formData.get('photo') as File | null;
      if (photo && photo.size > 0) {
        const buffer = await photo.arrayBuffer();
        styleReference = Buffer.from(buffer).toString('base64');
      }
    } else {
      const photos = formData.getAll('scene_photos') as File[];
      for (let i = 0; i < photos.length; i++) {
        if (photos[i].size > 0) {
          const buffer = await photos[i].arrayBuffer();
          const filePath = path.join(jobDir, `scene_${i + 1}.png`);
          await fs.writeFile(filePath, Buffer.from(buffer));
          scenePhotoPaths.push(filePath);
        }
      }
    }

    // Stream the pipeline progress via Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          // Stage 1: Script
          send({ stage: 'script', progress: 5, message: 'Generating script...' });
          const script = await generateScript(params);
          await fs.writeFile(path.join(jobDir, 'script.json'), JSON.stringify(script, null, 2));
          send({ stage: 'script', progress: 20, message: 'Script generated!', script });

          // Stage 2: Images
          const scenes = script.scenes;
          let imagePaths: string[] = [];

          if (params.mode === 'real' && scenePhotoPaths.length > 0) {
            send({ stage: 'images', progress: 35, message: `Using ${scenePhotoPaths.length} uploaded photos` });
            imagePaths = scenePhotoPaths.map((_, i) => `scene_${i + 1}.png`);
          } else {
            send({ stage: 'images', progress: 25, message: 'Generating images...' });
            imagePaths = await generateAllImages(
              scenes, params.aspect_ratio, jobDir, styleReference,
              (current, total) => {
                send({ stage: 'images', progress: 25 + (current / total) * 15, message: `Image ${current}/${total}...` });
              }
            );
          }
          send({ stage: 'images', progress: 40, message: 'Images ready!', images: imagePaths });

          // Stage 3: Videos (one at a time)
          send({ stage: 'videos', progress: 45, message: 'Starting video generation...' });
          const videoPaths: string[] = [];
          for (let i = 0; i < scenes.length; i++) {
            send({ stage: 'videos', progress: 45 + (i / scenes.length) * 25, message: `Generating video ${i + 1}/${scenes.length}...` });
            
            const imgPath = path.join(jobDir, imagePaths[i] || `scene_${i + 1}.png`);
            const imgBuffer = await fs.readFile(imgPath);
            const imgBase64 = imgBuffer.toString('base64');

            const videoFile = await generateSingleVideo(
              imgBase64,
              scenes[i].motion_prompt || scenes[i].motion_description || 'gentle smooth animation',
              params.duration,
              jobDir,
              i
            );
            videoPaths.push(videoFile);
            send({ stage: 'videos', progress: 45 + ((i + 1) / scenes.length) * 25, message: `Video ${i + 1}/${scenes.length} done!` });

            // Brief cooldown between scenes
            if (i < scenes.length - 1) {
              send({ stage: 'videos', progress: 45 + ((i + 1) / scenes.length) * 25, message: `Starting next video...` });
              await new Promise(r => setTimeout(r, 5000));
            }
          }

          // Stage 4: Audio
          send({ stage: 'audio', progress: 75, message: 'Generating narration...' });
          const audioPaths: string[] = [];
          for (let i = 0; i < scenes.length; i++) {
            const audioFile = await generateSingleAudio(
              scenes[i].dialogue || scenes[i].narration || '',
              params.voice,
              jobDir,
              i
            );
            audioPaths.push(audioFile);
            send({ stage: 'audio', progress: 75 + ((i + 1) / scenes.length) * 15, message: `Audio ${i + 1}/${scenes.length} done!` });
          }

          // Complete!
          send({
            stage: 'complete',
            progress: 100,
            message: 'Generation complete!',
            jobId,
            videos: videoPaths,
            audio: audioPaths,
            images: imagePaths,
            script,
          });

        } catch (err: any) {
          send({ stage: 'error', progress: 0, message: err.message || 'Pipeline failed', error: err.message });
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

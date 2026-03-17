import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createJob, updateJob, generateJobId, ensureJobDir } from '@/lib/jobs';
import { GenerationParams } from '@/lib/pipeline/types';
import { generateScript } from '@/lib/pipeline/script';
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

    // Save params for subsequent stages
    await fs.writeFile(
      path.join(jobDir, 'params.json'),
      JSON.stringify(params, null, 2)
    );

    // Handle file uploads immediately
    if (params.mode === 'ai') {
      const stylePhoto = formData.get('photo') as File | null;
      if (stylePhoto && stylePhoto.size > 0) {
        const buffer = await stylePhoto.arrayBuffer();
        await fs.writeFile(path.join(jobDir, 'style_reference.png'), Buffer.from(buffer));
      }
    } else {
      const scenePhotos = formData.getAll('scene_photos') as File[];
      for (let i = 0; i < scenePhotos.length; i++) {
        const photo = scenePhotos[i];
        if (photo.size > 0) {
          const buffer = await photo.arrayBuffer();
          await fs.writeFile(path.join(jobDir, `scene_${i + 1}.png`), Buffer.from(buffer));
        }
      }
    }

    // Create job — only do Stage 1 (script) in this request
    createJob(jobId);
    updateJob(jobId, { stage: 'script', progress: 5, message: 'Generating script...' });

    try {
      const script = await generateScript(params);
      await fs.writeFile(path.join(jobDir, 'script.json'), JSON.stringify(script, null, 2));
      
      updateJob(jobId, {
        stage: 'script_done',
        progress: 20,
        message: 'Script generated! Starting images...',
        script,
        files: { script: 'script.json' },
      });
    } catch (err: any) {
      updateJob(jobId, { stage: 'error', progress: 0, message: `Script generation failed: ${err.message}`, error: err.message });
    }

    return NextResponse.json({ jobId });
  } catch (error: any) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}

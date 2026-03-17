import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJob } from '@/lib/jobs';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
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

    // Load script if available
    let script = job.script;
    if (!script && job.files.script) {
      try {
        const scriptPath = path.join('/tmp/video-creator', jobId, job.files.script);
        const scriptData = await fs.readFile(scriptPath, 'utf-8');
        script = JSON.parse(scriptData);
      } catch {
        // Script file not found
      }
    }

    return NextResponse.json({
      ...job,
      script,
    });
  } catch (error: any) {
    console.error('Result error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get result' },
      { status: 500 }
    );
  }
}

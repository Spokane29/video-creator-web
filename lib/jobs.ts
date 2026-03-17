import { JobStatus } from './pipeline/types';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const JOB_DIR = '/tmp/video-creator';
const HISTORY_FILE = '/tmp/video-creator-history.json';

function jobStatusPath(jobId: string): string {
  return path.join(JOB_DIR, jobId, '_status.json');
}

export function createJob(jobId: string): JobStatus {
  const job: JobStatus = {
    jobId,
    stage: 'script',
    progress: 0,
    message: 'Starting script generation...',
    files: {},
  };
  // Ensure dir exists and write status synchronously
  const dir = path.join(JOB_DIR, jobId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(jobStatusPath(jobId), JSON.stringify(job));
  return job;
}

export function getJob(jobId: string): JobStatus | undefined {
  try {
    const data = fs.readFileSync(jobStatusPath(jobId), 'utf-8');
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export function updateJob(jobId: string, updates: Partial<JobStatus>): void {
  const job = getJob(jobId);
  if (job) {
    Object.assign(job, updates);
    fs.writeFileSync(jobStatusPath(jobId), JSON.stringify(job));
  }
}

export async function saveToHistory(job: JobStatus): Promise<void> {
  try {
    let history: JobStatus[] = [];
    try {
      const data = await fsp.readFile(HISTORY_FILE, 'utf-8');
      history = JSON.parse(data);
    } catch {}
    history.unshift(job);
    history = history.slice(0, 50);
    await fsp.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Failed to save to history:', error);
  }
}

export async function getHistory(): Promise<JobStatus[]> {
  try {
    const data = await fsp.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = path.join(JOB_DIR, jobId);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

import { JobStatus } from './pipeline/types';
import fs from 'fs/promises';
import path from 'path';

// In-memory job tracking (suitable for single-user app)
const jobs = new Map<string, JobStatus>();

// Job history for persistence
const historyFile = '/tmp/video-creator-history.json';

export function createJob(jobId: string): JobStatus {
  const job: JobStatus = {
    jobId,
    stage: 'script',
    progress: 0,
    message: 'Starting script generation...',
    files: {},
  };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): JobStatus | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, updates: Partial<JobStatus>): void {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
  }
}

export async function saveToHistory(job: JobStatus): Promise<void> {
  try {
    let history: JobStatus[] = [];
    try {
      const data = await fs.readFile(historyFile, 'utf-8');
      history = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }
    
    history.unshift(job);
    // Keep only last 50 jobs
    history = history.slice(0, 50);
    
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Failed to save to history:', error);
  }
}

export async function getHistory(): Promise<JobStatus[]> {
  try {
    const data = await fs.readFile(historyFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = path.join('/tmp/video-creator', jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

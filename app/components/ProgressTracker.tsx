'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface JobStatus {
  stage: string;
  progress: number;
  message: string;
  error?: string;
  files: { images?: string[]; videos?: string[]; audio?: string[] };
}

interface Props {
  jobId: string;
}

const STAGE_ORDER = ['script', 'images', 'videos', 'audio', 'complete'];

function getStageIndex(stage: string): number {
  if (stage.startsWith('video_')) return 2;
  if (stage.startsWith('audio_')) return 3;
  if (stage === 'script_done') return 1;
  if (stage === 'images_done') return 2;
  if (stage === 'videos_done') return 3;
  return STAGE_ORDER.indexOf(stage);
}

export default function ProgressTracker({ jobId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');
  const advancingRef = useRef(false);

  // Advance the pipeline by calling the next step
  const advancePipeline = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    try {
      const res = await fetch(`/api/pipeline/${jobId}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Pipeline step failed');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error');
    } finally {
      advancingRef.current = false;
    }
  }, [jobId]);

  useEffect(() => {
    let running = true;

    const pollAndAdvance = async () => {
      while (running) {
        try {
          // 1. Poll status
          const res = await fetch(`/api/status/${jobId}`);
          if (!res.ok) { await sleep(3000); continue; }
          const data: JobStatus = await res.json();
          setStatus(data);

          // 2. Check terminal states
          if (data.stage === 'complete') {
            setTimeout(() => router.push(`/result/${jobId}`), 2000);
            return;
          }
          if (data.stage === 'error') {
            setError(data.error || 'Generation failed');
            return;
          }

          // 3. If stage is a "_done" state, advance to next stage
          if (data.stage?.endsWith('_done') || data.stage === 'images_done' || data.stage === 'videos_done') {
            await advancePipeline();
            await sleep(2000); // Brief pause after advancing
          } else {
            // Still processing, wait longer before re-polling
            await sleep(5000);
          }
        } catch {
          await sleep(5000);
        }
      }
    };

    pollAndAdvance();
    return () => { running = false; };
  }, [jobId, router, advancePipeline]);

  if (!status) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8c00] mx-auto"></div>
        <p className="mt-4 text-gray-400">Starting pipeline...</p>
      </div>
    );
  }

  const currentIdx = getStageIndex(status.stage);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={() => { setError(''); advancePipeline(); }} className="mt-2 text-[#ff8c00] hover:underline text-sm">Retry</button>
        </div>
      )}

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">{status.message}</span>
          <span className="text-sm font-medium text-[#ff8c00]">{Math.round(status.progress)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div className="bg-[#ff8c00] h-3 rounded-full transition-all duration-500" style={{ width: `${status.progress}%` }}></div>
        </div>
      </div>

      {/* Stage Indicators */}
      <div className="flex justify-between">
        {['Script', 'Images', 'Videos', 'Audio', 'Complete'].map((stage, index) => {
          const isComplete = index < currentIdx || status.stage === 'complete';
          const isCurrent = index === currentIdx && status.stage !== 'complete';
          return (
            <div key={stage} className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                isComplete ? 'bg-[#ff8c00] text-white' : isCurrent ? 'bg-[#ff8c00]/30 text-[#ff8c00] animate-pulse' : 'bg-gray-700 text-gray-500'
              }`}>
                {isComplete ? '✓' : index + 1}
              </div>
              <span className="text-xs text-gray-400 text-center">{stage}</span>
            </div>
          );
        })}
      </div>

      {/* Images Preview */}
      {status.files?.images && status.files.images.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Generated Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {status.files.images.map((image, index) => (
              <div key={image} className="aspect-video bg-[#242424] rounded-lg overflow-hidden">
                <img src={`/api/outputs/${jobId}/${image}`} alt={`Scene ${index + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video generation note */}
      {status.stage?.startsWith('video_') && (
        <div className="bg-blue-500/10 border border-blue-500/50 text-blue-400 px-6 py-4 rounded-lg">
          <p className="text-sm"><strong>Note:</strong> Each video scene takes 1-2 minutes to generate. Please keep this page open.</p>
        </div>
      )}

      {/* Completion */}
      {status.stage === 'complete' && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-6 py-4 rounded-lg text-center">
          <p className="text-xl font-semibold mb-2">✨ Generation Complete!</p>
          <p className="text-sm">Redirecting to results...</p>
        </div>
      )}
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

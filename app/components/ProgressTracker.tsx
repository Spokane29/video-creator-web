'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProgressData {
  stage: string;
  progress: number;
  message: string;
  error?: string;
  images?: string[];
  videos?: string[];
  audio?: string[];
  script?: any;
  jobId?: string;
}

interface Props {
  jobId: string;
}

const STAGE_LABELS = ['Script', 'Images', 'Videos', 'Audio', 'Complete'];

function getStageIndex(stage: string): number {
  const map: Record<string, number> = { script: 0, images: 1, videos: 2, audio: 3, complete: 4 };
  return map[stage] ?? -1;
}

export default function ProgressTracker({ jobId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ProgressData>({ stage: 'starting', progress: 0, message: 'Connecting...' });
  const [error, setError] = useState('');
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    // The jobId is actually used to retrieve the SSE stream
    // The generate endpoint already started streaming when we got redirected here
    // We need to store the EventSource connection or use the stored stream

    // Actually, the form submission created the stream. We need a different approach:
    // Store the formData in sessionStorage, then re-POST from here to get the stream.
    
    const storedParams = sessionStorage.getItem(`job_${jobId}`);
    if (!storedParams) {
      setError('Job data not found. Please go back and try again.');
      return;
    }

    const formDataObj = JSON.parse(storedParams);
    const fd = new FormData();
    Object.entries(formDataObj).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        fd.append(key, value as string);
      }
    });

    // Add files from global temp storage
    const pendingFiles = (window as any).__pendingFiles;
    if (pendingFiles?.stylePhoto) {
      fd.append('photo', pendingFiles.stylePhoto);
    }
    if (pendingFiles?.scenePhotos) {
      pendingFiles.scenePhotos.forEach((p: File) => fd.append('scene_photos', p));
    }
    delete (window as any).__pendingFiles;

    // Start SSE stream
    fetch('/api/generate', { method: 'POST', body: fd })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json();
          setError(err.error || 'Generation failed');
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) { setError('No stream'); return; }
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: ProgressData = JSON.parse(line.slice(6));
                setStatus(data);

                if (data.images) setImages(prev => [...new Set([...prev, ...data.images!])]);
                if (data.stage === 'error') setError(data.error || data.message);
                if (data.stage === 'complete') {
                  // Store result data and redirect
                  sessionStorage.setItem(`result_${jobId}`, JSON.stringify(data));
                  setTimeout(() => router.push(`/result/${jobId}`), 2000);
                }
              } catch {}
            }
          }
        }
      })
      .catch(err => setError(err.message));
  }, [jobId, router]);

  const currentIdx = getStageIndex(status.stage);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
          <a href="/" className="mt-2 inline-block text-[#ff8c00] hover:underline text-sm">← Try again</a>
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
        {STAGE_LABELS.map((label, index) => {
          const isComplete = index < currentIdx || status.stage === 'complete';
          const isCurrent = index === currentIdx && status.stage !== 'complete' && status.stage !== 'error';
          return (
            <div key={label} className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                isComplete ? 'bg-[#ff8c00] text-white' : isCurrent ? 'bg-[#ff8c00]/30 text-[#ff8c00] animate-pulse' : 'bg-gray-700 text-gray-500'
              }`}>
                {isComplete ? '✓' : index + 1}
              </div>
              <span className="text-xs text-gray-400 text-center">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Images Preview */}
      {images.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Generated Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image, index) => (
              <div key={image} className="aspect-video bg-[#242424] rounded-lg overflow-hidden">
                <img src={`/api/outputs/${jobId}/${image}`} alt={`Scene ${index + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video generation note */}
      {status.stage === 'videos' && (
        <div className="bg-blue-500/10 border border-blue-500/50 text-blue-400 px-6 py-4 rounded-lg">
          <p className="text-sm"><strong>⏳ Please keep this page open.</strong> Each video scene takes 1-2 minutes with a 90-second cooldown between scenes.</p>
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

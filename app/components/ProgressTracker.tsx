'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobStatus } from '@/lib/pipeline/types';

interface Props {
  jobId: string;
}

const STAGES = ['script', 'images', 'videos', 'audio', 'assembly', 'complete'];

export default function ProgressTracker({ jobId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/status/${jobId}`);
        if (response.ok) {
          const data: JobStatus = await response.json();
          setStatus(data);

          // Redirect to results when complete
          if (data.stage === 'complete') {
            setTimeout(() => {
              router.push(`/result/${jobId}`);
            }, 2000);
          }

          // Show error if failed
          if (data.stage === 'error') {
            setError(data.error || 'Generation failed');
          }
        } else {
          setError('Failed to fetch status');
        }
      } catch (err) {
        setError('Connection error');
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [jobId, router]);

  if (!status) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8c00] mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading...</p>
      </div>
    );
  }

  const currentStageIndex = STAGES.indexOf(status.stage);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">
            {status.message}
          </span>
          <span className="text-sm font-medium text-[#ff8c00]">
            {Math.round(status.progress)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="bg-[#ff8c00] h-3 rounded-full transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Stage Indicators */}
      <div className="flex justify-between">
        {['Script', 'Images', 'Videos', 'Audio', 'Assembly'].map((stage, index) => {
          const isComplete = index < currentStageIndex || status.stage === 'complete';
          const isCurrent = index === currentStageIndex && status.stage !== 'complete';

          return (
            <div key={stage} className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                  isComplete
                    ? 'bg-[#ff8c00] text-white'
                    : isCurrent
                    ? 'bg-[#ff8c00]/30 text-[#ff8c00] animate-pulse'
                    : 'bg-gray-700 text-gray-500'
                }`}
              >
                {isComplete ? '✓' : index + 1}
              </div>
              <span className="text-xs text-gray-400 text-center">{stage}</span>
            </div>
          );
        })}
      </div>

      {/* Generated Images Preview */}
      {status.files.images && status.files.images.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Generated Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {status.files.images.map((image, index) => (
              <div key={image} className="aspect-video bg-[#242424] rounded-lg overflow-hidden">
                <img
                  src={`/api/outputs/${jobId}/${image}`}
                  alt={`Scene ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Message */}
      {status.stage === 'complete' && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-6 py-4 rounded-lg text-center">
          <p className="text-xl font-semibold mb-2">✨ Generation Complete!</p>
          <p className="text-sm">Redirecting to results...</p>
        </div>
      )}

      {/* Note about duration */}
      {status.stage === 'videos' && (
        <div className="bg-blue-500/10 border border-blue-500/50 text-blue-400 px-6 py-4 rounded-lg">
          <p className="text-sm">
            <strong>Note:</strong> Video generation includes a 90-second cooldown between scenes to avoid rate limits. This may take a while.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { JobStatus } from '@/lib/pipeline/types';
import Link from 'next/link';

export default function HistoryList() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/history');
        if (response.ok) {
          const data = await response.json();
          setJobs(data.jobs || []);
        } else {
          setError('Failed to load history');
        }
      } catch (err) {
        setError('Connection error');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8c00] mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg mb-6">No videos generated yet</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white font-semibold rounded-lg transition-colors"
        >
          Create Your First Video
        </Link>
      </div>
    );
  }

  const formatDate = (jobId: string) => {
    // Extract timestamp from jobId (format: job_TIMESTAMP_random)
    const timestamp = parseInt(jobId.split('_')[1]);
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (stage: string) => {
    if (stage === 'complete') {
      return (
        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
          Complete
        </span>
      );
    } else if (stage === 'error') {
      return (
        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
          Failed
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
          In Progress
        </span>
      );
    }
  };

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div
          key={job.jobId}
          className="bg-[#242424] rounded-lg p-6 hover:bg-[#2a2a2a] transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">
                {job.script?.title || 'Video Generation'}
              </h3>
              <p className="text-gray-400 text-sm mb-2">
                {formatDate(job.jobId)}
              </p>
              <p className="text-gray-400 text-sm">
                {job.script?.scenes.length || 0} scenes • {job.stage}
              </p>
            </div>
            <div>{getStatusBadge(job.stage)}</div>
          </div>

          {/* Progress bar for in-progress jobs */}
          {job.stage !== 'complete' && job.stage !== 'error' && (
            <div className="mb-4">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-[#ff8c00] h-2 rounded-full transition-all"
                  style={{ width: `${job.progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400 mt-1">{job.message}</p>
            </div>
          )}

          {/* Thumbnails */}
          {job.files.images && job.files.images.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {job.files.images.slice(0, 4).map((image, index) => (
                <img
                  key={index}
                  src={`/api/outputs/${job.jobId}/${image}`}
                  alt={`Scene ${index + 1}`}
                  className="h-20 w-auto rounded"
                />
              ))}
              {job.files.images.length > 4 && (
                <div className="h-20 w-20 bg-gray-700 rounded flex items-center justify-center text-gray-400 text-sm">
                  +{job.files.images.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {job.stage === 'complete' ? (
              <Link
                href={`/result/${job.jobId}`}
                className="px-4 py-2 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white rounded-lg transition-colors"
              >
                View Results
              </Link>
            ) : job.stage === 'error' ? (
              <span className="px-4 py-2 bg-gray-700 text-gray-400 rounded-lg">
                Generation Failed
              </span>
            ) : (
              <Link
                href={`/progress/${job.jobId}`}
                className="px-4 py-2 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white rounded-lg transition-colors"
              >
                View Progress
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

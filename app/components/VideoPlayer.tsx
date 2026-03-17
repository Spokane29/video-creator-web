'use client';

import { useEffect, useState } from 'react';
import { JobStatus, Script } from '@/lib/pipeline/types';
import Link from 'next/link';

interface Props {
  jobId: string;
}

export default function VideoPlayer({ jobId }: Props) {
  const [result, setResult] = useState<JobStatus & { script?: Script } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/result/${jobId}`);
        if (response.ok) {
          const data = await response.json();
          setResult(data);
        } else {
          setError('Failed to load results');
        }
      } catch (err) {
        setError('Connection error');
      }
    };

    fetchResult();
  }, [jobId]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8c00] mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading results...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Script */}
      {result.script && (
        <div className="bg-[#242424] rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-[#ff8c00]">
            {result.script.title}
          </h2>
          <div className="space-y-4">
            {result.script.scenes.map((scene, index) => (
              <div key={index} className="border-l-4 border-[#ff8c00] pl-4">
                <h3 className="font-semibold text-lg mb-2">
                  Scene {scene.scene_number}
                </h3>
                <p className="text-gray-300 mb-2">{scene.description}</p>
                <p className="text-gray-400 italic">&quot;{scene.dialogue}&quot;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scene Videos */}
      {result.files.videos && result.files.videos.length > 0 && (
        <div>
          <h3 className="text-2xl font-bold mb-4">Scene Videos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.files.videos.map((video, index) => (
              <div key={video} className="bg-[#242424] rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-[#ff8c00]">
                  Scene {index + 1}
                </h4>
                <video
                  controls
                  className="w-full rounded-lg mb-3"
                  src={`/api/outputs/${jobId}/${video}`}
                />
                <div className="flex gap-2">
                  <a
                    href={`/api/outputs/${jobId}/${video}`}
                    download
                    className="flex-1 py-2 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white text-center rounded-lg transition-colors"
                  >
                    Download Video
                  </a>
                  {result.files.audio && result.files.audio[index] && (
                    <a
                      href={`/api/outputs/${jobId}/${result.files.audio[index]}`}
                      download
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-center rounded-lg transition-colors"
                    >
                      Download Audio
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Gallery */}
      {result.files.images && result.files.images.length > 0 && (
        <div>
          <h3 className="text-2xl font-bold mb-4">Generated Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {result.files.images.map((image, index) => (
              <div key={image} className="bg-[#242424] rounded-lg overflow-hidden">
                <img
                  src={`/api/outputs/${jobId}/${image}`}
                  alt={`Scene ${index + 1}`}
                  className="w-full aspect-video object-cover"
                />
                <div className="p-2">
                  <a
                    href={`/api/outputs/${jobId}/${image}`}
                    download
                    className="block w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-center text-sm rounded transition-colors"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-center pt-8">
        <Link
          href="/"
          className="px-8 py-3 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white font-semibold rounded-lg transition-colors"
        >
          Generate Another Video
        </Link>
        <Link
          href="/history"
          className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
        >
          View History
        </Link>
      </div>
    </div>
  );
}

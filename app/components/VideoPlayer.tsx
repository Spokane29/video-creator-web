'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SceneData {
  scene_number: number;
  description: string;
  dialogue: string;
  image_prompt?: string;
  motion_prompt?: string;
}

interface ResultData {
  stage: string;
  progress: number;
  message: string;
  jobId?: string;
  script?: { title: string; scenes: SceneData[] };
  images?: string[];
  imageUrls?: string[];
  videos?: string[];
  audio?: string[];
}

interface Props {
  jobId: string;
}

export default function VideoPlayer({ jobId }: Props) {
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load from sessionStorage (saved by ProgressTracker on completion)
    const stored = sessionStorage.getItem(`result_${jobId}`);
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch {
        setError('Failed to parse results');
      }
    } else {
      // Fallback: try API (works locally, won't work on Vercel serverless)
      fetch(`/api/result/${jobId}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setResult({
              stage: 'complete',
              progress: 100,
              message: 'Complete',
              jobId,
              script: data.script,
              images: data.files?.images,
              videos: data.files?.videos,
              audio: data.files?.audio,
            });
          } else {
            setError('Results expired. Please generate a new video.');
          }
        })
        .catch(() => setError('Failed to load results'));
    }
  }, [jobId]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
        <p>{error}</p>
        <Link href="/" className="mt-2 inline-block text-[#ff8c00] hover:underline">← Generate a new video</Link>
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

  const imageUrls = result.imageUrls || [];
  const videos = result.videos || [];
  const audio = result.audio || [];

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
      {videos.length > 0 ? (
        <div>
          <h3 className="text-2xl font-bold mb-4">Scene Videos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map((video, index) => {
              const isUrl = video.startsWith('http');
              const videoSrc = isUrl ? video : `/api/outputs/${jobId}/${video}`;
              return (
                <div key={video} className="bg-[#242424] rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-[#ff8c00]">
                    Scene {index + 1}
                  </h4>
                  <video
                    controls
                    className="w-full rounded-lg mb-3"
                    src={videoSrc}
                  />
                  <div className="flex gap-2">
                    <a
                      href={videoSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white text-center rounded-lg transition-colors"
                    >
                      Download Video
                    </a>
                    {audio[index] && (
                      <a
                        href={audio[index].startsWith('http') ? audio[index] : `/api/outputs/${jobId}/${audio[index]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-center rounded-lg transition-colors"
                      >
                        Download Audio
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 px-4 py-3 rounded-lg">
          <p>No videos were generated. The pipeline may have timed out or hit an error during video generation.</p>
          <p className="text-sm mt-1">Vercel&apos;s hobby plan has a 60-second timeout which may not be enough for video generation.</p>
        </div>
      )}

      {/* Image Gallery */}
      {imageUrls.length > 0 && (
        <div>
          <h3 className="text-2xl font-bold mb-4">Generated Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {imageUrls.map((url, index) => (
              <div key={url} className="bg-[#242424] rounded-lg overflow-hidden">
                <img
                  src={url}
                  alt={`Scene ${index + 1}`}
                  className="w-full aspect-video object-cover"
                />
                <div className="p-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-center text-sm rounded transition-colors"
                  >
                    View Full Size
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
      </div>
    </div>
  );
}

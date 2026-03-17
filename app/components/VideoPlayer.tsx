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
  const [assembling, setAssembling] = useState(false);
  const [assemblyProgress, setAssemblyProgress] = useState('');
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`result_${jobId}`);
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch {
        setError('Failed to parse results');
      }
    } else {
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

  const handleAssemble = async () => {
    if (!result?.videos?.length) return;
    
    setAssembling(true);
    setAssemblyProgress('Loading video editor...');

    try {
      // Dynamic import to avoid loading ffmpeg.wasm unless needed
      const { assembleVideo } = await import('@/lib/assembler');
      
      const videoUrls = result.videos!;
      const audioUrls = result.audio || [];

      const blob = await assembleVideo(videoUrls, audioUrls, (msg) => {
        setAssemblyProgress(msg);
      });

      const url = URL.createObjectURL(blob);
      setFinalVideoUrl(url);
      setAssemblyProgress('');
    } catch (err: any) {
      setAssemblyProgress(`Assembly failed: ${err.message}`);
    } finally {
      setAssembling(false);
    }
  };

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
      {/* Final Assembled Video */}
      {finalVideoUrl && (
        <div className="bg-[#242424] rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-[#ff8c00]">🎬 Final Video</h2>
          <video
            controls
            autoPlay
            className="w-full rounded-lg mb-4"
            src={finalVideoUrl}
          />
          <a
            href={finalVideoUrl}
            download={`${result.script?.title || 'video'}.mp4`}
            className="inline-block px-6 py-3 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white font-semibold rounded-lg transition-colors"
          >
            ⬇️ Download Final Video
          </a>
        </div>
      )}

      {/* Assemble Button */}
      {!finalVideoUrl && videos.length > 0 && (
        <div className="bg-[#242424] rounded-lg p-6 text-center">
          {assembling ? (
            <div>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff8c00] mx-auto mb-4"></div>
              <p className="text-[#ff8c00] font-semibold">{assemblyProgress}</p>
              <p className="text-gray-400 text-sm mt-2">Combining {videos.length} scenes with voiceover into one video...</p>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white">Ready to Assemble</h2>
              <p className="text-gray-400 mb-4">
                {videos.length} scene{videos.length > 1 ? 's' : ''} generated with {audio.length} audio track{audio.length > 1 ? 's' : ''}.
                Click below to combine them into one final video with voiceover.
              </p>
              <button
                onClick={handleAssemble}
                className="px-8 py-3 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white font-bold text-lg rounded-lg transition-colors"
              >
                🎬 Assemble Final Video
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* Individual Scene Videos */}
      {videos.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-300">Individual Scenes</h3>
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
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-center text-sm rounded-lg transition-colors"
                    >
                      Video
                    </a>
                    {audio[index] && (
                      <a
                        href={audio[index].startsWith('http') ? audio[index] : `/api/outputs/${jobId}/${audio[index]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-center text-sm rounded-lg transition-colors"
                      >
                        Audio
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Image Gallery */}
      {imageUrls.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 text-gray-300">Generated Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {imageUrls.map((url, index) => (
              <div key={url} className="bg-[#242424] rounded-lg overflow-hidden">
                <img
                  src={url}
                  alt={`Scene ${index + 1}`}
                  className="w-full aspect-video object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No videos warning */}
      {videos.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 px-4 py-3 rounded-lg">
          <p>No videos were generated. The pipeline may have timed out (Vercel hobby plan has a 60-second limit).</p>
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

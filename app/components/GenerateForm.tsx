'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'ai' | 'real'>('ai');
  const [template, setTemplate] = useState('talking-characters');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [scenes, setScenes] = useState(3);
  const [duration, setDuration] = useState(6);
  const [voice, setVoice] = useState('nova');
  const [stylePhoto, setStylePhoto] = useState<File | null>(null);
  const [scenePhotos, setScenePhotos] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('mode', mode);
      formData.append('template', template);
      formData.append('aspect_ratio', aspectRatio);
      formData.append('scenes', scenes.toString());
      formData.append('duration', duration.toString());
      formData.append('voice', voice);

      if (stylePhoto) {
        formData.append('photo', stylePhoto);
      }

      scenePhotos.forEach((photo) => {
        formData.append('scene_photos', photo);
      });

      // Generate a job ID locally
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store form params (without files) for the progress page
      sessionStorage.setItem(`job_${jobId}`, JSON.stringify({
        prompt, mode, template, aspect_ratio: aspectRatio,
        scenes: scenes.toString(), duration: duration.toString(), voice,
      }));

      // Store files in a temporary global so progress page can access them
      (window as any).__pendingFiles = { stylePhoto, scenePhotos };

      router.push(`/progress/${jobId}`);
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Video Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00]"
          placeholder="Describe the video you want to create..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Image Style
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
              mode === 'ai'
                ? 'border-[#ff8c00] bg-[#ff8c00]/10 text-[#ff8c00]'
                : 'border-gray-700 bg-[#242424] text-gray-300 hover:border-gray-600'
            }`}
          >
            🎨 AI Generated
          </button>
          <button
            type="button"
            onClick={() => setMode('real')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
              mode === 'real'
                ? 'border-[#ff8c00] bg-[#ff8c00]/10 text-[#ff8c00]'
                : 'border-gray-700 bg-[#242424] text-gray-300 hover:border-gray-600'
            }`}
          >
            📸 Real Photos
          </button>
        </div>
      </div>

      {mode === 'ai' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Style Reference Photo (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setStylePhoto(e.target.files?.[0] || null)}
            className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#ff8c00] file:text-white file:cursor-pointer hover:file:bg-[#ff9d1f]"
          />
        </div>
      )}

      {mode === 'real' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Scene Photos (one per scene)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setScenePhotos(Array.from(e.target.files || []))}
            className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#ff8c00] file:text-white file:cursor-pointer hover:file:bg-[#ff9d1f]"
            required
          />
          {scenePhotos.length > 0 && (
            <p className="mt-2 text-sm text-gray-400">
              {scenePhotos.length} photo(s) selected
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Template
          </label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00]"
          >
            <option value="talking-characters">Talking Characters</option>
            <option value="property-tour">Property Tour</option>
            <option value="explainer">Explainer</option>
            <option value="pet-tips">Pet Tips</option>
            <option value="mortgage-tips">Mortgage Tips</option>
            <option value="cruise-highlights">Cruise Highlights</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Aspect Ratio
          </label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00]"
          >
            <option value="9:16">9:16 (Vertical) - Default</option>
            <option value="16:9">16:9 (Landscape)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="4:3">4:3 (Classic)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of Scenes
          </label>
          <select
            value={scenes}
            onChange={(e) => setScenes(parseInt(e.target.value))}
            className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00]"
          >
            <option value="2">2 scenes</option>
            <option value="3">3 scenes</option>
            <option value="4">4 scenes</option>
            <option value="5">5 scenes</option>
            <option value="6">6 scenes</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Duration per Scene
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00]"
          >
            <option value="5">5 seconds</option>
            <option value="6">6 seconds</option>
            <option value="7">7 seconds</option>
            <option value="8">8 seconds</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Voice
          </label>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full px-4 py-3 bg-[#242424] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00]"
          >
            <option value="nova">Nova (Default)</option>
            <option value="alloy">Alloy</option>
            <option value="echo">Echo</option>
            <option value="fable">Fable</option>
            <option value="onyx">Onyx</option>
            <option value="shimmer">Shimmer</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-[#ff8c00] hover:bg-[#ff9d1f] text-white font-semibold text-lg rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Starting Generation...' : '🎬 Generate Video'}
      </button>

      <p className="text-sm text-gray-400 text-center">
        Video generation may take several minutes. You&apos;ll be redirected to the progress page.
      </p>
    </form>
  );
}

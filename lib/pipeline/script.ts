import { Script, GenerationParams } from './types';
import { getTemplate } from '../templates';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function generateScript(params: GenerationParams): Promise<Script> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const template = await getTemplate(params.template);
  
  const systemPrompt = template 
    ? `You are creating a ${template.name} video. ${template.description}
       Style: ${template.style}
       Tone: ${template.tone}
       Scene structure: ${JSON.stringify(template.scene_structure)}`
    : 'You are creating an engaging short-form video.';

  const prompt = `${systemPrompt}

Create a video script with exactly ${params.scenes} scenes.
Topic: ${params.prompt}

Each scene should be ${params.duration} seconds long.

Respond ONLY with valid JSON in this exact format:
{
  "title": "Video Title",
  "scenes": [
    {
      "scene_number": 1,
      "description": "Visual description of what happens in this scene",
      "dialogue": "The narration text for this scene",
      "motion_description": "How the image should animate (camera movement, character actions)",
      "image_prompt": "Detailed prompt for generating the scene image"
    }
  ]
}

Make it engaging, concise, and suitable for ${params.aspect_ratio} aspect ratio.`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Script generation failed: ${error}`);
  }

  const data = await response.json();
  const textResponse = data.candidates[0].content.parts[0].text;
  
  // Extract JSON from response (in case it's wrapped in markdown)
  const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse script JSON from response');
  }

  const script: Script = JSON.parse(jsonMatch[0]);
  return script;
}

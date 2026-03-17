import { Script, GenerationParams } from './types';
import fs from 'fs/promises';
import path from 'path';

const FAL_KEY = process.env.FAL_KEY;

async function loadTemplate(templateName: string): Promise<any> {
  try {
    const templatePath = path.join(process.cwd(), 'templates', `${templateName}.json`);
    const data = await fs.readFile(templatePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function generateScript(params: GenerationParams): Promise<Script> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  const template = await loadTemplate(params.template);
  const templateContext = template
    ? `Style: ${template.style}. Tone: ${template.tone}. ${template.description || ''}`
    : '';

  const prompt = `You are a video script writer. Generate a JSON script for a ${params.scenes}-scene animated short video.

Topic: ${params.prompt}
${templateContext}

Rules:
- Each scene has dialogue/narration under 25 words
- Each scene has a detailed image_prompt for generating the visual (include art style, character description, setting)
- Each scene has a motion_prompt describing how the scene should animate
- Return ONLY valid JSON, no markdown, no explanation

JSON format:
{
  "title": "Video Title",
  "scenes": [
    {
      "scene_number": 1,
      "description": "Brief scene description",
      "dialogue": "The narration text for this scene",
      "image_prompt": "Detailed visual description for image generation",
      "motion_prompt": "How the scene should animate (camera movement, character actions)"
    }
  ]
}`;

  const res = await fetch('https://fal.run/fal-ai/any-llm', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-70b-instruct',
      prompt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Script generation failed: ${err}`);
  }

  const data = await res.json();
  const output = data.output || '';

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = output;
  const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  } else {
    // Try to find raw JSON
    const braceMatch = output.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }
  }

  try {
    const script: Script = JSON.parse(jsonStr.trim());
    if (!script.title || !script.scenes || !Array.isArray(script.scenes)) {
      throw new Error('Invalid script structure');
    }
    return script;
  } catch (e) {
    throw new Error(`Failed to parse script JSON: ${e}. Raw output: ${output.slice(0, 200)}`);
  }
}

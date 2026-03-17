import { Template } from './pipeline/types';
import fs from 'fs/promises';
import path from 'path';

const templatesDir = path.join(process.cwd(), 'templates');

export async function getTemplate(name: string): Promise<Template | null> {
  try {
    const filePath = path.join(templatesDir, `${name}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function listTemplates(): Promise<string[]> {
  try {
    const files = await fs.readdir(templatesDir);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

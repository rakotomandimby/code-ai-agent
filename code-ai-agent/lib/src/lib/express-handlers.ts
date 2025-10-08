import { Request, Response } from 'express';
import * as db from './db-instance';

export interface ConfigPayload {
  type: 'api key' | 'system instructions' | 'model' | 'prompt';
  text: string;
}

export interface FilePayload {
  type: 'file';
  filename: string;
  content: string;
}

export type RequestBody = FilePayload | ConfigPayload;

export const handleConfig = async (req: Request, res: Response): Promise<void> => {
  const { type, text } = req.body as ConfigPayload;
  const keyMap = {
    'api key': 'api_key',
    'system instructions': 'system_instructions',
    'model': 'model',
    'prompt': 'prompt',
  };
  const dbKey = keyMap[type];

  if (!text) {
    res.status(400).json({ error: `Missing text field for ${type}` });
    return;
  }

  if (type === 'api key') {
    await db.resetDatabase();
  }

  const { lastID } = await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [dbKey, text]);
  res.json({ message: `${type} stored successfully`, rowId: lastID });
};

export const handleFile = async (req: Request, res: Response): Promise<void> => {
  const { filename, content } = req.body as FilePayload;
  if (!filename || !content) {
    res.status(400).json({ error: 'Missing filename or content for file' });
    return;
  }
  const { lastID } = await db.run('INSERT INTO data (file_path, file_content) VALUES (?, ?)', [filename, content]);
  res.json({ message: 'File data stored successfully', rowId: lastID });
};

export interface PromptHandler {
  (req: Request, res: Response): Promise<void>;
}

export function createPromptHandler(
  processPrompt: (apiKey: string, model: string, instructions: string) => Promise<any>
): PromptHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { text } = req.body as ConfigPayload;
    if (!text) {
      res.status(400).json({ error: 'Missing text field for prompt' });
      return;
    }

    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['prompt', text]);

    const apiKey = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['api_key']))?.value;
    const model = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['model']))?.value;
    const instructions = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';

    if (!apiKey) {
      res.status(400).json({ error: 'API key not set' });
      return;
    }
    if (!model) {
      res.status(400).json({ error: 'Model not set' });
      return;
    }

    // Wait 3 seconds to ensure DB updates are visible
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const apiResponse = await processPrompt(apiKey, model, instructions);
    res.json(apiResponse);
  };
}


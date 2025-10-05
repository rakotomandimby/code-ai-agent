import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as db from './db';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = express();
app.use(express.json());

// Utility delay function
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Type Definitions ---
interface FilePayload {
  type: 'file';
  filename: string;
  content: string;
}

interface ConfigPayload {
  type: 'api key' | 'system instructions' | 'model' | 'prompt';
  text: string;
}

type RequestBody = FilePayload | ConfigPayload;

// --- API Interaction (OpenAI Responses API) ---
async function buildRequestBody(): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<{ file_path: string; file_content: string }>(
    'SELECT file_path, file_content FROM data ORDER BY id ASC'
  );

  // Build a single markdown document as input
  const parts: string[] = [];

  parts.push('# Project Files');
  if (dataEntries.length === 0) {
    parts.push('_No files provided._');
  } else {
    for (const entry of dataEntries) {
      parts.push(
        `## File: ${entry.file_path}\n\n` +
          '```\n' +
          `${entry.file_content}\n` +
          '```'
      );
    }
  }

  if (prompt) {
    parts.push(`\n\n${prompt.trim()}`);
  }

  const input = parts.join('\n\n');
  return {
    // Model will be set in postToOpenAI
    input,
    max_output_tokens: 1024*96
  };
}

function postToOpenAI(requestBody: any, apiKey: string, model: string, instructions: string): Promise<any> {
  const url = 'https://api.openai.com/v1/responses';
  requestBody.model = model;
  requestBody.instructions = instructions;

  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  });
}

// --- Route Handlers ---
const handleConfig = async (req: Request, res: Response) => {
  const { type, text } = req.body as ConfigPayload;
  const keyMap = {
    'api key': 'api_key',
    'system instructions': 'system_instructions',
    'model': 'model',
    'prompt': 'prompt',
  };
  const dbKey = keyMap[type];

  if (!text) {
    return res.status(400).json({ error: `Missing text field for ${type}` });
  }

  if (type === 'api key') {
    await db.resetDatabase();
  }

  const { lastID } = await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [dbKey, text]);
  console.log(`${type} stored with row ID: ${lastID}`);
  res.json({ message: `${type} stored successfully`, rowId: lastID });
};

const handleFile = async (req: Request, res: Response) => {
  const { filename, content } = req.body as FilePayload;
  if (!filename || !content) {
    return res.status(400).json({ error: 'Missing filename or content for file' });
  }
  const { lastID } = await db.run('INSERT INTO data (file_path, file_content) VALUES (?, ?)', [filename, content]);
  console.log(`File data stored with row ID: ${lastID}`);
  res.json({ message: 'File data stored successfully', rowId: lastID });
};

const handlePrompt = async (req: Request, res: Response) => {
  const { text } = req.body as ConfigPayload;
  if (!text) {
    return res.status(400).json({ error: 'Missing text field for prompt' });
  }

  await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['prompt', text]);

  const apiKey = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['api_key']))?.value;
  const model = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['model']))?.value;
  const instructions = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';

  if (!apiKey) return res.status(400).json({ error: 'API key not set' });
  if (!model) return res.status(400).json({ error: 'Model not set' });

  // Wait 3 seconds to ensure DB updates are visible before building the request body
  await delay(3000);
  const requestBody = await buildRequestBody();
  const apiResponse = await postToOpenAI(requestBody, apiKey, model, instructions);
  res.json(apiResponse.data);
};

// --- Express App Setup ---
app.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body as RequestBody;
    switch (type) {
      case 'api key':
      case 'system instructions':
      case 'model':
        await handleConfig(req, res);
        break;
      case 'file':
        await handleFile(req, res);
        break;
      case 'prompt':
        await handlePrompt(req, res);
        break;
      default:
        res.status(400).json({ error: `Invalid type specified: ${type}` });
    }
  } catch (error) {
    next(error);
  }
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error processing request:', err);
  if (axios.isAxiosError(err) && err.response) {
    console.error('Error calling OpenAI API:', err.response.data);
    return res.status(500).json({ error: 'Failed to process prompt with OpenAI API', details: err.response.data });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// --- Server Initialization ---
async function startServer() {
  try {
    db.removeDatabaseFile();
    await db.connectToDatabase();
    await db.initializeDatabase();
    app.listen(port, host, () => {
      console.log(`[ ready ] http://${host}:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

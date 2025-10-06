import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as db from './db';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 5000;

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

// --- API Interaction ---
async function buildRequestBody(): Promise<any> {
  const systemInstructions = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';
  const prompt = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<{ file_path: string, file_content: string }>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const contents: Array<{ role: string, parts: Array<{ text: string }> }> = [];

  let firstUserMessage = 'I need your help on this project.';
  if (systemInstructions) {
    firstUserMessage = `${systemInstructions}\n\n${firstUserMessage}`;
  }

  contents.push({ role: 'user', parts: [{ text: firstUserMessage }] });
  contents.push({ role: 'model', parts: [{ text: "Understood. I am ready to help. Please provide the file contents." }] });

  for (const entry of dataEntries) {
    contents.push({ role: 'user', parts: [{ text: `The content of the ${entry.file_path} file is: ${entry.file_content}` }] });
    contents.push({ role: 'model', parts: [{ text: `I have read the content of ${entry.file_path}.` }] });
  }

  if (prompt) {
    contents.push({ role: 'user', parts: [{ text: prompt }] });
  }

  return {
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 1,
    }
  };
}

function postToGoogleAI(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
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
  res.json({ message: `${type} stored successfully`, rowId: lastID });
};

const handleFile = async (req: Request, res: Response) => {
  const { filename, content } = req.body as FilePayload;
  if (!filename || !content) {
    return res.status(400).json({ error: 'Missing filename or content for file' });
  }
  const { lastID } = await db.run('INSERT INTO data (file_path, file_content) VALUES (?, ?)', [filename, content]);
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

  if (!apiKey) return res.status(400).json({ error: 'API key not set' });
  if (!model) return res.status(400).json({ error: 'Model not set' });

  // Wait 3 seconds to ensure DB updates are visible before building the request body
  await delay(3000);
  const requestBody = await buildRequestBody();
  const apiResponse = await postToGoogleAI(requestBody, apiKey, model);
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
    console.error('Error calling Google AI API:', err.response.data);
    return res.status(500).json({ error: 'Failed to process prompt with Google AI API', details: err.response.data });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// --- Server Initialization ---
async function startServer() {
  try {
    db.removeDatabaseFile();
    await db.connectToDatabase();
    await db.initializeDatabase();
    app.listen(port, () => {
      console.log(`[ ready ] http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

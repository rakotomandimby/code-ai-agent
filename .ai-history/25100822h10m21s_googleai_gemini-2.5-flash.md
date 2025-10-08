# Inform about processing 

I want each agent to print several things when it processes a user request:

- Print ">>>> Request received on {AGENT_NAME}" when it receives the "api key" data
- Print ">>>> Waiting a bit before sending the request to the {AGENT_NAME} - {AI_MODEL}" just before the 3 seconds wait
- Print ">>>> Sending request to {AGENT_NAME} - {AI_MODEL}" just before sending the request to the AI model
- Print "<<<< Response received from {AGENT_NAME} - {AI_MODEL}" (took {TIME_TAKEN}s)" when it receives the response from the AI_MODEL

Where {AGENT_NAME} is the name of the agent (GoogleAI, OpenAI, Anthropic), {AI_MODEL} is the model being used (e.g., gpt-4, gpt-3.5-turbo, claude-2, etc.),
and {TIME_TAKEN} is the time between sending the request to the AI model API and receiving the response.

Tell me the full content of the files I need to change in order to implement this logging functionality.


# GGL To implement the logging functionality, we need to modify the shared library's `express-handlers.ts` and `express-app.ts` files, as well as the `main.ts` files for the Anthropic and OpenAI agents.

Here are the full contents of the files you need to change:

---

**1. `./code-ai-agent/lib/src/lib/express-handlers.ts`**

This file will be updated to:
*   Export a `createConfigHandler` factory function instead of a direct `handleConfig` function. This factory will capture the `apiName` to use in logging.
*   Add the "Request received on {AGENT_NAME}" log when an 'api key' is set.
*   Modify the `createPromptHandler` to accept `apiName` and log "Waiting a bit..." before the 3-second delay.
*   Pass the `apiName` to the `processPrompt` function.

```typescript
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

// Changed handleConfig to a factory function createConfigHandler
export function createConfigHandler(apiName: string) {
  return async (req: Request, res: Response): Promise<void> => {
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
      console.log(`>>>> Request received on ${apiName}`);
      await db.resetDatabase();
    }

    const { lastID } = await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [dbKey, text]);
    res.json({ message: `${type} stored successfully`, rowId: lastID });
  };
}

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
  processPrompt: (apiKey: string, model: string, instructions: string, apiName: string) => Promise<any>,
  apiName: string // Added apiName parameter
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

    console.log(`>>>> Waiting a bit before sending the request to the ${apiName} - ${model}`); // Log 2
    // Wait 3 seconds to ensure DB updates are visible
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const apiResponse = await processPrompt(apiKey, model, instructions, apiName); // Pass apiName
    res.json(apiResponse);
  };
}

```

---

**2. `./code-ai-agent/lib/src/lib/express-app.ts`**

This file will be updated to:
*   Import `createConfigHandler` instead of `handleConfig`.
*   Call `createConfigHandler` with `apiName` to get the handler for config-related requests.

```typescript
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { RequestBody, createConfigHandler, handleFile, PromptHandler } from './express-handlers'; // Changed handleConfig to createConfigHandler

export function createApp(handlePrompt: PromptHandler, apiName: string): express.Application {
  const app = express();
  app.use(express.json());

  const configHandler = createConfigHandler(apiName); // Create the config handler with apiName

  app.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body as RequestBody;
      switch (type) {
        case 'api key':
        case 'system instructions':
        case 'model':
          await configHandler(req, res); // Use the created handler
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
      console.error(`Error calling ${apiName} API:`, err.response.data);
      return res.status(500).json({
        error: `Failed to process prompt with ${apiName} API`,
        details: err.response.data
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

```

---

**3. `./code-ai-agent/lib/src/index.ts`**

This file needs to correctly export the new `createConfigHandler` function. The `export * from './lib/express-handlers';` statement will automatically pick up `createConfigHandler` and no longer export `handleConfig`.

```typescript
export * from './lib/lib';
export * from './lib/db';
export * from './lib/db-instance';
export * from './lib/express-handlers';
export * from './lib/express-app';
export * from './lib/server';
```

---

**4. `./code-ai-agent/anthropic-agent/src/main.ts`**

This file will be updated to:
*   Modify the `processPrompt` function to accept `apiName`.
*   Add the "Sending request to {AGENT_NAME} - {AI_MODEL}" log before the API call.
*   Add the "Response received from {AGENT_NAME} - {AI_MODEL} (took {TIME_TAKEN}s)" log after the API call, calculating the time taken.
*   Pass the agent's name ('Anthropic') to `createPromptHandler`.

```typescript
import axios from 'axios';
import * as db from './db';
import { setDbStore, createApp, createPromptHandler, startServer } from '@code-ai-agent/lib';

const port = process.env.PORT ? Number(process.env.PORT) : 6000;

// Initialize the db instance for the shared library
setDbStore({
  connectToDatabase: db.connectToDatabase,
  getDb: db.getDb,
  run: db.run,
  get: db.get,
  all: db.all,
  initializeDatabase: db.initializeDatabase,
  resetDatabase: db.resetDatabase,
  removeDatabaseFile: db.removeDatabaseFile,
});

type DataEntry = { file_path: string; file_content: string };
type Message = { role: 'user' | 'assistant'; content: string };

// --- API Interaction ---
async function buildRequestBody(systemInstructions: string): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<DataEntry>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const messages: Message[] = [];

  messages.push({
    role: 'user',
    content: 'I need your help on this project.',
  });

  for (const entry of dataEntries) {
    messages.push({
      role: 'assistant',
      content: `Please provide the content of the \`${entry.file_path}\` file.`,
    });
    messages.push({
      role: 'user',
      content: `Here is the content of the \`${entry.file_path}\` file:\n\`\`\`\n${entry.file_content}\n\`\`\`\n`,
    });
  }

  if (!dataEntries.length && !prompt) {
    messages.push({
      role: 'assistant',
      content: 'How would you like to proceed with this project?',
    });
  }

  if (prompt) {
    messages.push({
      role: 'assistant',
      content: 'What would you like to do next?',
    });
    messages.push({
      role: 'user',
      content: prompt,
    });
  }

  return {
    max_tokens: 32000,
    system: systemInstructions || undefined,
    messages,
  };
}

function postToAnthropic(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = 'https://api.anthropic.com/v1/messages';
  requestBody.model = model;

  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
}

function createErrorResponse(errorMessage: string, model: string): any {
  return {
    content: [
      {
        text: errorMessage,
        type: 'text'
      }
    ],
    model: model,
    role: 'assistant',
    stop_reason: 'end_turn',
    type: 'message',
    usage: {
      input_tokens: 0,
      output_tokens: 0
    }
  };
}

async function processPrompt(apiKey: string, model: string, instructions: string, apiName: string): Promise<any> {
  try {
    const requestBody = await buildRequestBody(instructions);

    console.log(`>>>> Sending request to ${apiName} - ${model}`); // Log 3
    const startTime = process.hrtime.bigint(); // Start timer

    const apiResponse = await postToAnthropic(requestBody, apiKey, model);

    const endTime = process.hrtime.bigint(); // End timer
    const timeTakenSeconds = Number(endTime - startTime) / 1_000_000_000;
    console.log(`<<<< Response received from ${apiName} - ${model} (took ${timeTakenSeconds.toFixed(2)}s)`); // Log 4

    return apiResponse.data;
  } catch (error) {
    let errorMessage = 'An unknown error occurred while processing your request.';

    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage = `API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessage = 'Network error: No response received from the API.';
      } else {
        errorMessage = `Request error: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;
    }

    console.error('Anthropic API error:', errorMessage);
    return createErrorResponse(errorMessage, model);
  }
}

const handlePrompt = createPromptHandler(processPrompt, 'Anthropic'); // Pass agent name
const app = createApp(handlePrompt, 'Anthropic');

startServer(app, port, db.removeDatabaseFile);

```

---

**5. `./code-ai-agent/openai-agent/src/main.ts`**

This file will be updated to:
*   Modify the `processPrompt` function to accept `apiName`.
*   Add the "Sending request to {AGENT_NAME} - {AI_MODEL}" log before the API call.
*   Add the "Response received from {AGENT_NAME} - {AI_MODEL} (took {TIME_TAKEN}s)" log after the API call, calculating the time taken.
*   Pass the agent's name ('OpenAI') to `createPromptHandler`.

```typescript
import axios from 'axios';
import * as db from './db';
import { setDbStore, createApp, createPromptHandler, startServer } from '@code-ai-agent/lib';

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// Initialize the db instance for the shared library
setDbStore({
  connectToDatabase: db.connectToDatabase,
  getDb: db.getDb,
  run: db.run,
  get: db.get,
  all: db.all,
  initializeDatabase: db.initializeDatabase,
  resetDatabase: db.resetDatabase,
  removeDatabaseFile: db.removeDatabaseFile,
});

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
    input,
    max_output_tokens: 1024 * 96
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

function createErrorResponse(errorMessage: string, model: string): any {
  return {
    model: model,
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: errorMessage,
            annotations: []
          }
        ]
      }
    ],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0
    },
  };
}

async function processPrompt(apiKey: string, model: string, instructions: string, apiName: string): Promise<any> {
  try {
    const requestBody = await buildRequestBody();

    console.log(`>>>> Sending request to ${apiName} - ${model}`); // Log 3
    const startTime = process.hrtime.bigint(); // Start timer

    const apiResponse = await postToOpenAI(requestBody, apiKey, model, instructions);

    const endTime = process.hrtime.bigint(); // End timer
    const timeTakenSeconds = Number(endTime - startTime) / 1_000_000_000;
    console.log(`<<<< Response received from ${apiName} - ${model} (took ${timeTakenSeconds.toFixed(2)}s)`); // Log 4

    return apiResponse.data;
  } catch (error) {
    let errorMessage = 'An unknown error occurred while processing your request.';

    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage = `API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessage = 'Network error: No response received from the API.';
      } else {
        errorMessage = `Request error: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;
    }

    console.error('OpenAI API error:', errorMessage);
    return createErrorResponse(errorMessage, model);
  }
}

const handlePrompt = createPromptHandler(processPrompt, 'OpenAI'); // Pass agent name
const app = createApp(handlePrompt, 'OpenAI');

startServer(app, port, db.removeDatabaseFile);

```

GoogleAI gemini-2.5-flash (10k in, 4k out)



#file_glob:code-ai-agent/googleai-agent/**/*.ts
#file_glob:code-ai-agent/anthropic-agent/**/*.ts
#file_glob:code-ai-agent/openai-agent/**/*.ts
#file_glob:code-ai-agent/lib/**/*.ts
#file:code-ai-agent/package.json


# Do not propagate API error. 

If the API ever returns an error, I want each agent to build a response that puts the error message in the response and formats the response as if it was successful.

For Anthropic, the response should be formatted as:

```
{
  "content": [
    {
      "citations": null,
      "text": "{error message here}",
      "type": "text"
    }
  ],
  "id": "msg_013Zva2CMHLNnXjNJJKqJ2EF",
  "model": "claude-sonnet-4-5-20250929",
  "role": "assistant",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "type": "message",
  "usage": {
    "input_tokens": 0,
    "output_tokens":0
  }
}
```

For OpenAI, the response should be formatted as:

```
{
  "id": "resp_67ccd2bed1ec8190b14f964abc0542670bb6a6b452d3795b",
  "object": "response",
  "created_at": 1741476542,
  "status": "completed",
  "error": null,
  "incomplete_details": null,
  "instructions": null,
  "max_output_tokens": null,
  "model": "gpt-4.1-2025-04-14",
  "output": [
    {
      "type": "message",
      "id": "msg_67ccd2bf17f0819081ff3bb2cf6508e60bb6a6b452d3795b",
      "status": "completed",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "{error message here}",
          "annotations": []
        }
      ]
    }
  ],
  "parallel_tool_calls": true,
  "previous_response_id": null,
  "reasoning": {
    "effort": null,
    "summary": null
  },
  "store": true,
  "temperature": 1.0,
  "text": {
    "format": {
      "type": "text"
    }
  },
  "tool_choice": "auto",
  "tools": [],
  "top_p": 1.0,
  "truncation": "disabled",
  "usage": {
    "input_tokens": 0,
    "input_tokens_details": {
      "cached_tokens": 0
    },
    "output_tokens": 0,
    "output_tokens_details": {
      "reasoning_tokens": 0
    },
    "total_tokens": 0
  },
  "user": null,
  "metadata": {}
}
```

For GoogleAI, the response should be formatted as:

```
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "{error message here}"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 1
    }
  ]
}
```

Note: For google, add the tokens information as 0 for all fields.

# Task 

Tell me the full new contents of the files I need to modify to implement this change.



# OPN Implement consistent success-style error handling for agent API failures
I update the shared prompt handler to accept custom error formatters, add a utility that extracts meaningful error messages, and wire each agent to return success-shaped payloads containing API error details without propagating the original errors.

## Files Modified or Created
- code-ai-agent/lib/src/lib/error-utils.ts
- code-ai-agent/lib/src/lib/express-handlers.ts
- code-ai-agent/lib/src/index.ts
- code-ai-agent/openai-agent/src/main.ts
- code-ai-agent/googleai-agent/src/main.ts
- code-ai-agent/anthropic-agent/src/main.ts

### code-ai-agent/lib/src/lib/error-utils.ts
I introduce reusable helpers that derive readable error messages from strings, generic objects, and Axios-style response payloads, ensuring graceful degradation to a fallback message.
```typescript
export function extractErrorMessage(error: unknown): string {
  const fallbackMessage = 'An unknown error occurred while processing the API request.';

  if (error === null || error === undefined) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed ? trimmed : fallbackMessage;
  }

  let message: string | null = null;

  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed) {
      message = trimmed;
    }
  }

  if (typeof error === 'object') {
    const errorObject = error as Record<string, unknown>;
    const response = 'response' in errorObject ? (errorObject as any).response : undefined;
    if (response && typeof response === 'object' && 'data' in response) {
      message = extractMessageFromData((response as any).data);
    }

    if (!message) {
      message = extractMessageFromData(errorObject);
    }
  }

  return message ?? fallbackMessage;
}

function extractMessageFromData(data: unknown, depth = 0): string | null {
  if (depth > 3 || data === undefined || data === null) {
    return null;
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data.toString();
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const candidate = extractMessageFromData(item, depth + 1);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const keysToCheck = ['error', 'message', 'detail', 'details', 'error_description', 'errorMessage'];

    for (const key of keysToCheck) {
      if (key in record) {
        const candidate = extractMessageFromData(record[key], depth + 1);
        if (candidate) {
          return candidate;
        }
      }
    }

    try {
      const serialized = JSON.stringify(record);
      const trimmed = serialized.trim();
      return trimmed ? trimmed : null;
    } catch {
      return null;
    }
  }

  return null;
}
```

### code-ai-agent/lib/src/lib/express-handlers.ts
I extend the shared prompt handler to accept a formatter for API errors, returning custom responses instead of escalating errors to the global handler.
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

export interface PromptContext {
  apiKey: string;
  model: string;
  instructions: string;
}

export function createPromptHandler(
  processPrompt: (apiKey: string, model: string, instructions: string) => Promise<any>,
  formatApiError?: (error: unknown, context: PromptContext) => any
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
    const instructions =
      (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';

    if (!apiKey) {
      res.status(400).json({ error: 'API key not set' });
      return;
    }
    if (!model) {
      res.status(400).json({ error: 'Model not set' });
      return;
    }

    try {
      // Wait 3 seconds to ensure DB updates are visible
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const apiResponse = await processPrompt(apiKey, model, instructions);
      res.json(apiResponse);
    } catch (error) {
      console.error('Error while processing prompt:', error);
      if (formatApiError) {
        const formatted = formatApiError(error, { apiKey, model, instructions });
        res.json(formatted);
        return;
      }
      throw error;
    }
  };
}
```

### code-ai-agent/lib/src/index.ts
I re-export the new error utility for agent usage.
```typescript
export * from './lib/lib';
export * from './lib/db';
export * from './lib/db-instance';
export * from './lib/express-handlers';
export * from './lib/error-utils';
export * from './lib/express-app';
export * from './lib/server';
```

### code-ai-agent/openai-agent/src/main.ts
I pass a formatter that shapes OpenAI errors into success-like responses, using the shared extractor to populate the assistant message.
```typescript
import axios from 'axios';
import * as db from './db';
import {
  setDbStore,
  createApp,
  createPromptHandler,
  startServer,
  extractErrorMessage,
  PromptContext
} from '@code-ai-agent/lib';

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
    max_output_tokens: 1024 * 96,
  };
}

function postToOpenAI(requestBody: any, apiKey: string, model: string, instructions: string): Promise<any> {
  const url = 'https://api.openai.com/v1/responses';
  requestBody.model = model;
  requestBody.instructions = instructions;

  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody();
  const apiResponse = await postToOpenAI(requestBody, apiKey, model, instructions);
  return apiResponse.data;
}

function formatOpenAIError(error: unknown, context: PromptContext): any {
  const errorMessage = extractErrorMessage(error);
  const timestamp = Math.floor(Date.now() / 1000);
  const randomSegment = Math.random().toString(16).slice(2, 10);
  const baseId = `${timestamp}${randomSegment}`;

  return {
    id: `resp_${baseId}`,
    object: 'response',
    created_at: timestamp,
    status: 'completed',
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: context.model,
    output: [
      {
        type: 'message',
        id: `msg_${baseId}`,
        status: 'completed',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: errorMessage,
            annotations: [],
          },
        ],
      },
    ],
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: {
      effort: null,
      summary: null,
    },
    store: true,
    temperature: 1.0,
    text: {
      format: {
        type: 'text',
      },
    },
    tool_choice: 'auto',
    tools: [],
    top_p: 1.0,
    truncation: 'disabled',
    usage: {
      input_tokens: 0,
      input_tokens_details: {
        cached_tokens: 0,
      },
      output_tokens: 0,
      output_tokens_details: {
        reasoning_tokens: 0,
      },
      total_tokens: 0,
    },
    user: null,
    metadata: {},
  };
}

const handlePrompt = createPromptHandler(processPrompt, formatOpenAIError);
const app = createApp(handlePrompt, 'OpenAI');

startServer(app, port, db.removeDatabaseFile);
```

### code-ai-agent/googleai-agent/src/main.ts
I attach a formatter that converts Google AI errors into the requested candidate and usage structure with zeroed token counts.
```typescript
import axios from 'axios';
import * as db from './db';
import {
  setDbStore,
  createApp,
  createPromptHandler,
  startServer,
  extractErrorMessage,
  PromptContext
} from '@code-ai-agent/lib';

const port = process.env.PORT ? Number(process.env.PORT) : 5000;

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
type Content = { role: 'user' | 'model'; parts: Array<{ text: string }> };

// --- API Interaction ---
async function buildRequestBody(systemInstructions: string): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<DataEntry>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const contents: Content[] = [];

  contents.push({
    role: 'user',
    parts: [{ text: 'I need your help on this project.' }],
  });

  for (const entry of dataEntries) {
    contents.push({
      role: 'model',
      parts: [{ text: `Please provide the content of the \`${entry.file_path}\` file.` }],
    });
    contents.push({
      role: 'user',
      parts: [
        {
          text: `Here is the content of the \`${entry.file_path}\` file:\n\`\`\`\n${entry.file_content}\n\`\`\`\n`,
        },
      ],
    });
  }

  if (!dataEntries.length && !prompt) {
    contents.push({
      role: 'model',
      parts: [{ text: 'How would you like to proceed with this project?' }],
    });
  }

  if (prompt) {
    contents.push({
      role: 'model',
      parts: [{ text: 'What would you like to do next?' }],
    });
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });
  }

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 1,
    },
  };

  if (systemInstructions) {
    requestBody.system_instruction = {
      role: 'system',
      parts: [{ text: systemInstructions }],
    };
  }

  return requestBody;
}

function postToGoogleAI(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
  });
}

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody(instructions);
  const apiResponse = await postToGoogleAI(requestBody, apiKey, model);
  return apiResponse.data;
}

function formatGoogleAiError(error: unknown, _context: PromptContext): any {
  const errorMessage = extractErrorMessage(error);
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: errorMessage,
            },
          ],
          role: 'model',
        },
        finishReason: 'STOP',
        index: 1,
      },
    ],
    usageMetadata: {
      promptTokenCount: 0,
      cachedContentTokenCount: 0,
      totalTokenCount: 0,
    },
  };
}

const handlePrompt = createPromptHandler(processPrompt, formatGoogleAiError);
const app = createApp(handlePrompt, 'Google AI');

startServer(app, port, db.removeDatabaseFile);
```

### code-ai-agent/anthropic-agent/src/main.ts
I ensure Anthropic errors yield the requested message envelope with usage counts set to zero and the model echoed back.
```typescript
import axios from 'axios';
import * as db from './db';
import {
  setDbStore,
  createApp,
  createPromptHandler,
  startServer,
  extractErrorMessage,
  PromptContext
} from '@code-ai-agent/lib';

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

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody(instructions);
  const apiResponse = await postToAnthropic(requestBody, apiKey, model);
  return apiResponse.data;
}

function formatAnthropicError(error: unknown, context: PromptContext): any {
  const errorMessage = extractErrorMessage(error);
  const randomSegment = Math.random().toString(16).slice(2, 10);

  return {
    content: [
      {
        citations: null,
        text: errorMessage,
        type: 'text',
      },
    ],
    id: `msg_${randomSegment}`,
    model: context.model,
    role: 'assistant',
    stop_reason: 'end_turn',
    stop_sequence: null,
    type: 'message',
    usage: {
      input_tokens: 0,
      output_tokens: 0,
    },
  };
}

const handlePrompt = createPromptHandler(processPrompt, formatAnthropicError);
const app = createApp(handlePrompt, 'Anthropic');

startServer(app, port, db.removeDatabaseFile);
```

OpenAI gpt-5-codex (9299 in, 16911 out)



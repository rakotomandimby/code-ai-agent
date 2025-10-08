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



# GGL Implement API Error Handling with Formatted Responses

I will implement a robust error handling mechanism for API calls in the AI agents. When an external API (OpenAI, Google AI, Anthropic) returns an error, the agent will now catch this error and format a "successful" response containing the error message, instead of propagating the API error directly. This ensures a consistent response structure from the agent's endpoint, regardless of upstream API failures.

I will achieve this by:
1.  **Modifying `lib/src/lib/express-handlers.ts`**: I will introduce a new helper function `generateErrorResponse` to create the specific error response formats for each AI provider. I will then update the `createPromptHandler` function to include a `try...catch` block around the `processPrompt` call. In the `catch` block, it will extract the error message, use `generateErrorResponse` to format it, and send this formatted response back to the client. This centralizes the error formatting logic.
2.  **Modifying `lib/src/lib/express-app.ts`**: I will adjust the `createApp` function's signature to directly accept the `processPrompt` function and the `apiName`. It will then use `createPromptHandler` internally to create the route handler. The global error handler will be simplified, as API-specific errors will now be handled upstream by `createPromptHandler`.
3.  **Modifying agent `main.ts` files**: For `openai-agent`, `googleai-agent`, and `anthropic-agent`, I will update the `createApp` call in their respective `src/main.ts` files to pass the `processPrompt` function and the `apiName` directly, aligning with the updated `createApp` signature.

Here are the full contents of the modified files:

---

### `code-ai-agent/lib/src/lib/express-handlers.ts`

```typescript
import { Request, Response } from 'express';
import * as db from './db-instance';
import axios from 'axios'; // Import axios to check for AxiosError

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

/**
 * Generates a mock "successful" API response containing an error message,
 * formatted according to the specified AI provider's typical response structure.
 * @param apiName The name of the AI API ('OpenAI', 'Google AI', 'Anthropic').
 * @param errorMessage The error message to embed in the response.
 * @returns An object formatted as a successful API response, but containing the error.
 */
function generateErrorResponse(apiName: string, errorMessage: string): any {
  const timestamp = Math.floor(Date.now() / 1000); // For OpenAI created_at field

  switch (apiName) {
    case 'Anthropic':
      return {
        "content": [
          {
            "citations": null,
            "text": errorMessage,
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
          "output_tokens": 0
        }
      };
    case 'OpenAI':
      return {
        "id": "resp_67ccd2bed1ec8190b14f964abc0542670bb6a6b452d3795b",
        "object": "response",
        "created_at": timestamp,
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
                "text": errorMessage,
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
      };
    case 'Google AI':
      return {
        "candidates": [
          {
            "content": {
              "parts": [
                {
                  "text": errorMessage
                }
              ],
              "role": "model"
            },
            "finishReason": "STOP",
            "index": 1
          }
        ],
        "promptFeedback": {
          "safetyRatings": []
        },
        "usageMetadata": {
          "promptTokenCount": 0,
          "candidatesTokenCount": 0,
          "totalTokenCount": 0
        }
      };
    default:
      // Fallback for unknown API or if apiName is not provided
      return { error: `Unknown API or error during prompt processing: ${errorMessage}` };
  }
}

export function createPromptHandler(
  processPrompt: (apiKey: string, model: string, instructions: string) => Promise<any>,
  apiName: string // `apiName` is now passed to createPromptHandler
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

    try {
      const apiResponse = await processPrompt(apiKey, model, instructions);
      res.json(apiResponse);
    } catch (error) {
      let errorMessage = 'An unknown error occurred during API call.';
      if (axios.isAxiosError(error) && error.response) {
        // Attempt to get a more specific error message from Axios response
        errorMessage = `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      console.error(`Error calling ${apiName} API:`, errorMessage, error);

      // Generate the "fake successful" error response
      const formattedErrorResponse = generateErrorResponse(apiName, errorMessage);
      res.json(formattedErrorResponse);
    }
  };
}

```

---

### `code-ai-agent/lib/src/lib/express-app.ts`

```typescript
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { RequestBody, handleConfig, handleFile, createPromptHandler } from './express-handlers'; // Import createPromptHandler

export function createApp(
  processPrompt: (apiKey: string, model: string, instructions: string) => Promise<any>, // Changed signature
  apiName: string // `apiName` is now passed to createApp
): express.Application {
  const app = express();
  app.use(express.json());

  // Create the prompt handler with the specific processPrompt and apiName
  // This handlePrompt now encapsulates the try/catch logic for API calls
  const handlePrompt = createPromptHandler(processPrompt, apiName);

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
          await handlePrompt(req, res); // This handlePrompt now includes the try/catch logic for API calls
          break;
        default:
          res.status(400).json({ error: `Invalid type specified: ${type}` });
      }
    } catch (error) {
      // This catch block will only be reached for errors NOT caught by handlePrompt
      // (e.g., config/file handlers, or other middleware errors).
      // API call errors are now handled directly within `handlePrompt`.
      next(error); // Pass to global error handler
    }
  });

  // Global error handler - simplified as API errors are handled upstream in createPromptHandler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Global error handler caught an error:', err);
    // Log details if it's an Axios error, even if it shouldn't happen for prompt calls now.
    if (axios.isAxiosError(err) && err.response) {
      console.error(`Axios error details:`, err.response.data);
    }
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  return app;
}

```

---

### `code-ai-agent/googleai-agent/src/main.ts`

```typescript
import axios from 'axios';
import * as db from './db';
import { setDbStore, createApp, createPromptHandler, startServer } from '@code-ai-agent/lib';

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

// Pass processPrompt function and API name directly to createApp
const app = createApp(processPrompt, 'Google AI');

startServer(app, port, db.removeDatabaseFile);

```

---

### `code-ai-agent/anthropic-agent/src/main.ts`

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

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody(instructions);
  const apiResponse = await postToAnthropic(requestBody, apiKey, model);
  return apiResponse.data;
}

// Pass processPrompt function and API name directly to createApp
const app = createApp(processPrompt, 'Anthropic');

startServer(app, port, db.removeDatabaseFile);

```

---

### `code-ai-agent/openai-agent/src/main.ts`

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

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody();
  const apiResponse = await postToOpenAI(requestBody, apiKey, model, instructions);
  return apiResponse.data;
}

// Pass processPrompt function and API name directly to createApp
const app = createApp(processPrompt, 'OpenAI');

startServer(app, port, db.removeDatabaseFile);

```

GoogleAI gemini-2.5-flash (12k in, 5k out)



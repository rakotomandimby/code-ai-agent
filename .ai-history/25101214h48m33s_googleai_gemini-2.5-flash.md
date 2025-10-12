# Check overall uniformity in the code 

I noticed, for exemple, that in the OpenAI `main.ts` file, I have:

```ts
type DataEntry = { file_path: string; file_content: string };
type ConversationMessage = { role: 'user' | 'assistant'; content: string };
```

I am not sure the other agents code has the same data structure.
I want to make the look of the code uniform across the different agents,
so that we can easily see that it has been developed by one person that has the same style.

We will level it by taking what is good, and applying it to all the agents code.
Do not leave unused code, remove it.

Tell me the full new content of the files that need to be changed to make the code uniform across the different agents.


# GGL To achieve uniformity across the different agents, I will focus on standardizing type names and removing unused code. The core logic for building the request body is already quite similar in its flow, and differences in message structure (`parts` vs `content`) and role names (`model` vs `assistant`) are due to the specific API requirements, which should be preserved.

Here's the plan:

1.  **Standardize Type Names**:
    *   In `googleai-agent/src/main.ts`, rename `type Content` to `type ConversationMessage`.
    *   In `anthropic-agent/src/main.ts`, rename `type Message` to `type ConversationMessage`.
2.  **Remove Unused Code**:
    *   The `lib()` function in `lib/src/lib/lib.ts` is not used anywhere. I will remove this file.
    *   Consequently, the export `export * from './lib/lib';` in `lib/src/index.ts` will also be removed.

Here are the full new contents of the files that will be changed:

---

**`./code-ai-agent/googleai-agent/src/main.ts`**
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
type ConversationMessage = { role: 'user' | 'model'; parts: Array<{ text: string }> };

// --- API Interaction ---
async function buildRequestBody(systemInstructions: string): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<DataEntry>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const contents: ConversationMessage[] = [];

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

function createErrorResponse(errorMessage: string): any {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: errorMessage
            }
          ],
          role: 'model'
        },
      }
    ],
    usageMetadata: {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0
    }
  };
}

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  try {
    const requestBody = await buildRequestBody(instructions);
    const apiResponse = await postToGoogleAI(requestBody, apiKey, model);
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

    console.error('Google AI API error:', errorMessage);
    return createErrorResponse(errorMessage);
  }
}

const handlePrompt = createPromptHandler(processPrompt, 'GoogleAI');
const app = createApp(handlePrompt, 'GoogleAI');

startServer(app, port, db.removeDatabaseFile);
```

---

**`./code-ai-agent/anthropic-agent/src/main.ts`**
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
type ConversationMessage = { role: 'user' | 'assistant'; content: string };

// --- API Interaction ---
async function buildRequestBody(systemInstructions: string): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<DataEntry>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const messages: ConversationMessage[] = [];

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

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  try {
    const requestBody = await buildRequestBody(instructions);
    const apiResponse = await postToAnthropic(requestBody, apiKey, model);
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

const handlePrompt = createPromptHandler(processPrompt, 'Anthropic');
const app = createApp(handlePrompt, 'Anthropic');

startServer(app, port, db.removeDatabaseFile);
```

---

**`./code-ai-agent/lib/src/lib/lib.ts`**
*(This file will be removed as it contains unused code.)*

---

**`./code-ai-agent/lib/src/index.ts`**
```typescript
export * from './lib/db';
export * from './lib/db-instance';
export * from './lib/express-handlers';
export * from './lib/express-app';
export * from './lib/server';
```

GoogleAI gemini-2.5-flash (10.6k in, 2.67k out)



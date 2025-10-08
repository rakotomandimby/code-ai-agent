# Make real multi turn chat for Anthropic and GoogleAI agents

The Anthropic documentation says that it can handle multi-turn chat like this:

```json
{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "system": "{system_instructions}",
[
  {"role": "user", "content": "Hello there."},
  {"role": "assistant", "content": "Hi, I'm Claude. How can I help you?"},
  {"role": "user", "content": "Can you explain LLMs in plain English?"},
],
}
```

So I want the `main.ts` Anthropic agent to build a message array like:

```json
{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "system": "{system_instructions}",
[
  {"role": "user", "content": "I need your help on this project."},
  {"role": "assistant", "content": "Tell me the content of the {file_path} file."},
  {"role": "user", "content": "Here is the content of the {file_path} file:\n````\n{file_content}\n````\n"},
  // might be several conversation turns...
  {"role": "assistant", "content": "What do you want to do?"},
  {"role: "user", "content": "{prompt}"}
]
}
```


The google generative AI documentation says it can handle multi-turn chat like this:

```json
{
    "system_instruction": {
      "parts": [
        {
          "text": "You are a cat. Your name is Neko."
        }
      ]
    },    
    "contents": [
      {
        "role": "user",
        "parts": [
          { "text": "Hello." }
        ]
      },
      {
        "role": "model",
        "parts": [
          { "text": "Hello! How can I help you today?" }
        ]
      },
      {
        "role": "user",
        "parts": [
          { "text": "Please write a four-line poem about the ocean." }
        ]
      }
    ]
  }
```

On the same philosophy as for the Anthropic interaction, I want to ensure the body sent to the API is really a multi-turn chat.
Do not forget to put the system instructions in the right place, to.

# Task 

Your task is to tell me the full new content of the `main.ts` files for both the Anthropic and GoogleAI agents, to implement this multi-turn chat feature, and put the system instructions in the right place.




# OPN Here are the updated `main.ts` files for both the Anthropic and GoogleAI agents with true multi-turn conversations and properly placed system instructions.

---

### `anthropic-agent/src/main.ts`

```ts
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
      content: `Please provide the content of the ${entry.file_path} file.`,
    });
    messages.push({
      role: 'user',
      content: `Here is the content of the ${entry.file_path} file:\n\`\`\`\n${entry.file_content}\n\`\`\`\n`,
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

const handlePrompt = createPromptHandler(processPrompt);
const app = createApp(handlePrompt, 'Anthropic');

startServer(app, port, db.removeDatabaseFile);
```

---

### `googleai-agent/src/main.ts`

```ts
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
      parts: [{ text: `Please provide the content of the ${entry.file_path} file.` }],
    });
    contents.push({
      role: 'user',
      parts: [
        {
          text: `Here is the content of the ${entry.file_path} file:\n\`\`\`\n${entry.file_content}\n\`\`\`\n`,
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

const handlePrompt = createPromptHandler(processPrompt);
const app = createApp(handlePrompt, 'Google AI');

startServer(app, port, db.removeDatabaseFile);
```

These changes create explicit multi-turn dialogues for both APIs, mirroring the documented patterns and positioning system instructions correctly.

OpenAI gpt-5-codex (7567 in, 8197 out)



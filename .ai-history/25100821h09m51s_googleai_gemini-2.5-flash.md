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




# GGL Here are the updated `main.ts` files for the Anthropic and GoogleAI agents, implementing the multi-turn chat feature and placing system instructions according to each API's documentation.

---

### `./code-ai-agent/anthropic-agent/src/main.ts`

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

// --- API Interaction ---
async function buildRequestBody(): Promise<any> {
  const systemInstructions = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';
  const prompt = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<{ file_path: string, file_content: string }>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const messages: Array<{ role: string, content: string }> = [];

  // Initial turn: User states the project need
  messages.push({ role: 'user', content: 'I need your help on this project.' });
  // Agent's initial response
  messages.push({ role: 'assistant', content: 'Understood. I am ready to help. Please provide the file contents.' });

  // Add file content turns
  for (const entry of dataEntries) {
    // User provides file content
    messages.push({
      role: 'user',
      content: `The content of the ${entry.file_path} file is:\n\`\`\`\n${entry.file_content}\n\`\`\`\n`
    });
    // Agent acknowledges reading the file
    messages.push({ role: 'assistant', content: `I have read the content of ${entry.file_path}.` });
  }

  // Add the final prompt if it exists
  if (prompt) {
    messages.push({ role: 'user', content: prompt });
  }

  return {
    max_tokens: 32000,
    system: systemInstructions || undefined, // System instructions are a top-level field
    messages
  };
}

function postToAnthropic(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = 'https://api.anthropic.com/v1/messages';
  requestBody.model = model;

  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  });
}

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody();
  const apiResponse = await postToAnthropic(requestBody, apiKey, model);
  return apiResponse.data;
}

const handlePrompt = createPromptHandler(processPrompt);
const app = createApp(handlePrompt, 'Anthropic');

startServer(app, port, db.removeDatabaseFile);
```

---

### `./code-ai-agent/googleai-agent/src/main.ts`

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

// --- API Interaction ---
async function buildRequestBody(): Promise<any> {
  const systemInstructions = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';
  const prompt = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<{ file_path: string, file_content: string }>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const contents: Array<{ role: string, parts: Array<{ text: string }> }> = [];

  // Initial user message
  contents.push({ role: 'user', parts: [{ text: 'I need your help on this project.' }] });
  // Agent's initial response
  contents.push({ role: 'model', parts: [{ text: "Understood. I am ready to help. Please provide the file contents." }] });

  // Add file content turns
  for (const entry of dataEntries) {
    // User provides file content
    contents.push({ role: 'user', parts: [{ text: `The content of the ${entry.file_path} file is: ${entry.file_content}` }] });
    // Agent acknowledges reading the file
    contents.push({ role: 'model', parts: [{ text: `I have read the content of ${entry.file_path}.` }] });
  }

  // Add the final prompt if it exists
  if (prompt) {
    contents.push({ role: 'user', parts: [{ text: prompt }] });
  }

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 1,
    }
  };

  // Add system instructions as a top-level field if they exist
  if (systemInstructions) {
    requestBody.system_instruction = {
      parts: [{ text: systemInstructions }]
    };
  }

  return requestBody;
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

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody();
  const apiResponse = await postToGoogleAI(requestBody, apiKey, model);
  return apiResponse.data;
}

const handlePrompt = createPromptHandler(processPrompt);
const app = createApp(handlePrompt, 'Google AI');

startServer(app, port, db.removeDatabaseFile);
```

GoogleAI gemini-2.5-flash (9k in, 1k out)



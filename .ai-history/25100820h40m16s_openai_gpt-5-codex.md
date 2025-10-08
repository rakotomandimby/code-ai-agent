# Factorization of GoogleAI main.ts file

I have performed a factorization of the `main.ts` file of Anthropi and OpenAI agents.
Is there any thing I can do for the GoogleAI agent `main.ts` file?

The code must work and compile without errors.
Tell me the full new content of the files I need to modify for that.



# OPN Refactor Google AI agent main entry to reuse shared infrastructure

I refactor the Google AI agent’s entry point so it mirrors the shared architecture already used by the other agents, wiring it into the common Express, database, and prompt-handling helpers from the shared library.

I register the agent’s SQLite store with `setDbStore`, delegate HTTP handling to `createApp`, reuse the shared prompt workflow with `createPromptHandler`, and keep the Google-specific request-build and API-call logic intact while integrating system instructions through the handler’s arguments.

## Modified Files
- googleai-agent/src/main.ts

### googleai-agent/src/main.ts
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
async function buildRequestBody(instructions: string): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<{ file_path: string; file_content: string }>(
    'SELECT file_path, file_content FROM data ORDER BY id ASC'
  );

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  let firstUserMessage = 'I need your help on this project.';
  if (instructions) {
    firstUserMessage = `${instructions}\n\n${firstUserMessage}`;
  }

  contents.push({ role: 'user', parts: [{ text: firstUserMessage }] });
  contents.push({
    role: 'model',
    parts: [{ text: 'Understood. I am ready to help. Please provide the file contents.' }]
  });

  for (const entry of dataEntries) {
    contents.push({
      role: 'user',
      parts: [{ text: `The content of the ${entry.file_path} file is: ${entry.file_content}` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: `I have read the content of ${entry.file_path}.` }]
    });
  }

  if (prompt) {
    contents.push({ role: 'user', parts: [{ text: prompt }] });
  }

  return {
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 1
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

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody(instructions);
  const apiResponse = await postToGoogleAI(requestBody, apiKey, model);
  return apiResponse.data;
}

const handlePrompt = createPromptHandler(processPrompt);
const app = createApp(handlePrompt, 'Google AI');

startServer(app, port, db.removeDatabaseFile);
```

This refactoring keeps the Google-specific prompt construction and API interaction intact while delegating all Express boilerplate, database initialization, and prompt lifecycle handling to the shared utilities for consistency across agents.

OpenAI gpt-5-codex (9202 in, 2811 out)



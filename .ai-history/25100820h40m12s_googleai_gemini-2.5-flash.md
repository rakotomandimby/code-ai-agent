# Factorization of GoogleAI main.ts file

I have performed a factorization of the `main.ts` file of Anthropi and OpenAI agents.
Is there any thing I can do for the GoogleAI agent `main.ts` file?

The code must work and compile without errors.
Tell me the full new content of the files I need to modify for that.



# GGL Factorizing GoogleAI Agent's main.ts for Shared Library Usage

I will refactor the `googleai-agent/src/main.ts` file to leverage the shared `@code-ai-agent/lib` package, aligning its structure with the `anthropic-agent` and `openai-agent` services. This involves moving common Express application setup, error handling, and prompt processing logic into the shared library, while keeping Google AI-specific API interaction details within the `googleai-agent` project.

Specifically, I will:
1.  Initialize the shared database store (`@code-ai-agent/lib/db-instance.ts`) using the local `db` module (`googleai-agent/src/db.ts`).
2.  Remove duplicated `express` setup, type definitions, and route handlers (`handleConfig`, `handleFile`, and the manual `handlePrompt`) from `googleai-agent/src/main.ts`.
3.  Encapsulate the Google AI-specific `buildRequestBody` and `postToGoogleAI` functions within a `processPrompt` function, which will then be passed to the shared `createPromptHandler`.
4.  Utilize the `createApp` function from the shared library to set up the Express application with the centralized request handling.
5.  Use the `startServer` function from the shared library for consistent server initialization and database management.

This refactoring will significantly reduce the boilerplate code in `googleai-agent/src/main.ts` and improve maintainability by centralizing common functionalities.

## Files to be modified

- `googleai-agent/src/main.ts`

---

## `googleai-agent/src/main.ts`

```typescript
import axios from 'axios';
import * as localDb from './db'; // Use localDb for clarity when initializing the store
import { setDbStore, createApp, createPromptHandler, startServer } from '@code-ai-agent/lib';

const port = process.env.PORT ? Number(process.env.PORT) : 5000;

// Initialize the db instance for the shared library
// The shared library's db functions (get, all, run, etc.) will now use this localDb instance.
setDbStore({
  connectToDatabase: localDb.connectToDatabase,
  getDb: localDb.getDb,
  run: localDb.run,
  get: localDb.get,
  all: localDb.all,
  initializeDatabase: localDb.initializeDatabase,
  resetDatabase: localDb.resetDatabase,
  removeDatabaseFile: localDb.removeDatabaseFile,
});

// --- API Interaction ---
// buildRequestBody remains here as it's specific to Google AI's content structure.
// It uses `localDb.get` and `localDb.all` which refer to the database instance
// configured by `googleai-agent/src/db.ts`.
async function buildRequestBody(): Promise<any> {
  const systemInstructions = (await localDb.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';
  const prompt = (await localDb.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await localDb.all<{ file_path: string, file_content: string }>('SELECT file_path, file_content FROM data ORDER BY id ASC');

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

// postToGoogleAI remains here as it's specific to Google AI's API endpoint and headers.
function postToGoogleAI(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    }
  });
}

// processPrompt encapsulates the Google AI-specific logic for generating a response.
// The 3-second delay previously in the main.ts handlePrompt is now managed by the shared createPromptHandler.
async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  const requestBody = await buildRequestBody();
  const apiResponse = await postToGoogleAI(requestBody, apiKey, model);
  return apiResponse.data;
}

// Create the prompt handler using the shared library's factory function
const handlePrompt = createPromptHandler(processPrompt);

// Create the Express application using the shared library's factory function
const app = createApp(handlePrompt, 'Google AI');

// Start the server using the shared library's function
startServer(app, port, localDb.removeDatabaseFile);
```

GoogleAI gemini-2.5-flash (11k in, 1k out)



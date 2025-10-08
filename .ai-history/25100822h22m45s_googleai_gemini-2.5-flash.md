# Inform about processing 

I want each agent to print several things when it processes a user request:

- Print ">>>> Request received on {AGENT_NAME}" when it receives the "api key" data
- Print ">>>> Waiting a bit before sending the request to the {AGENT_NAME} - {AI_MODEL}" just before the 3 seconds wait
- Print ">>>> Sending request to {AGENT_NAME} - {AI_MODEL}" just before sending the request to the AI model
- Print "<<<< Response received from {AGENT_NAME} - {AI_MODEL}" (took {TIME_TAKEN}s)" when it receives the response from the AI_MODEL

Where {AGENT_NAME} is the name of the agent (GoogleAI, OpenAI, Anthropic), {AI_MODEL} is the model being used (e.g., gpt-4, gpt-3.5-turbo, claude-2, etc.),
and {TIME_TAKEN} is the time between sending the request to the AI model API and receiving the response.

I made the changes for Anthropic agent, OpenAI agent, but I need you to give me the content for the GoogleAI agent.
Tell me the full content of the files I need to change in order to implement this logging functionality.


# GGL Implement logging for Google AI agent

I will update the `googleai-agent/src/main.ts` file to ensure that the agent's name, "Google AI", is correctly passed to the `createPromptHandler` function. This will enable the shared logging functionality in the `@code-ai-agent/lib` package to print the agent's name along with the model and time taken during request processing, aligning with the logging behavior of the Anthropic and OpenAI agents. The other requested logging messages are already handled by the shared `createApp` and `createPromptHandler` functions in the `lib` package, so no further changes are needed for those.

### Files to be modified:

-   `googleai-agent/src/main.ts`

```typescript
// googleai-agent/src/main.ts
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

// I am updating the createPromptHandler call to pass the agent name 'Google AI'
const handlePrompt = createPromptHandler(processPrompt, 'Google AI');
const app = createApp(handlePrompt, 'Google AI');

startServer(app, port, db.removeDatabaseFile);
```

GoogleAI gemini-2.5-flash (12k in, 1k out)



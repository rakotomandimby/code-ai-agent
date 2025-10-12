# Convert OpenAI request body to multi-turn chat format

Current resquest body sent to OpenAI API is not multi-turn chat.
But request body sent to Anthropics and GoogleAI are multi-turn chat.

I want to convert the request body sent to OpenAI API to multi-turn chat.

Tell me the full new content of the files I need to modify in order to achieve sending multi-turn chat request body to OpenAI API.



# OPN Convert the OpenAI agent payload into a multi-turn chat conversation for the Responses API  
I convert the OpenAI agent request construction so that the payload sent to the Responses API is now a structured multi-turn chat conversation, mirroring the approach already used for the Anthropic and GoogleAI agents while preserving resilience when no prompt or files are present.

## Updated File: `code-ai-agent/openai-agent/src/main.ts`

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

type DataEntry = { file_path: string; file_content: string };
type ConversationMessage = { role: 'user' | 'assistant'; content: string };

// --- API Interaction (OpenAI Responses API) ---
async function buildRequestBody(): Promise<any> {
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
      content: prompt.trim(),
    });
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    messages.push({
      role: 'user',
      content: 'Please let me know how you would like to proceed.',
    });
  }

  return {
    input: messages.map(({ role, content }) => ({
      role,
      content,
    })),
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
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
  };
}

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  try {
    const requestBody = await buildRequestBody();
    const apiResponse = await postToOpenAI(requestBody, apiKey, model, instructions);
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

const handlePrompt = createPromptHandler(processPrompt, 'OpenAI');
const app = createApp(handlePrompt, 'OpenAI');

startServer(app, port, db.removeDatabaseFile);
```

## Explanation
I restructured `buildRequestBody` to assemble a multi-turn chat conversation that mirrors the interaction flow used in the other agents: it now yields an array of role/content pairs representing the dialogue, guarantees the final entry is a user message as required by the Responses API, and leaves the rest of the request pipeline unchanged so existing behaviors (including instruction handling and error responses) continue to function.

## Modified Files
- `code-ai-agent/openai-agent/src/main.ts`

OpenAI gpt-5-codex (9.91k in, 5.02k out)



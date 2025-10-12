# Convert OpenAI request body to multi-turn chat format

Current resquest body sent to OpenAI API is not multi-turn chat.
But request body sent to Anthropics and GoogleAI are multi-turn chat.

I want to convert the request body sent to OpenAI API to multi-turn chat.

Tell me the full new content of the files I need to modify in order to achieve sending multi-turn chat request body to OpenAI API.



# GGL Convert OpenAI request body to multi-turn chat format

I will modify the `openai-agent/src/main.ts` file to convert the OpenAI API request body to a multi-turn chat format, aligning it with the provided "Responses API" specifications for multi-turn conversations. This involves restructuring the `input` field to be an array of message objects (with `role` and `content`), including system instructions as a `system` role message, and removing the `temperature` parameter (though it was not explicitly present in the OpenAI agent's request body before, I ensure it's not added).

Here are the changes I'm making:

1.  **Define a `Message` type**: I introduce a `Message` type to represent the structure of individual messages in the multi-turn conversation (`role: 'system' | 'user' | 'assistant'`, `content: string`).
2.  **Update `buildRequestBody` function**:
    *   It now accepts `systemInstructions: string` as a parameter.
    *   I initialize an array of `Message` objects called `messages`.
    *   If `systemInstructions` are provided, I add them as the first message with `role: 'system'` to the `messages` array, as per the specification.
    *   I adapt the logic from the Anthropic and GoogleAI agents to construct the multi-turn conversation history based on `dataEntries` and the current `prompt`, adding `user` and `assistant` messages to the `messages` array.
    *   The final `prompt` from the user will be the last `user` message in the `messages` array.
    *   The function now returns an object with an `input` field, which is this `messages` array, and `max_output_tokens`.
3.  **Update `postToOpenAI` function**:
    *   I remove the `instructions` parameter and the line `requestBody.instructions = instructions;` since system instructions are now handled within the `input` array in `buildRequestBody`.
4.  **Update `processPrompt` function**:
    *   I ensure that the `instructions` parameter is passed to `buildRequestBody`.
    *   I update the call to `postToOpenAI` to no longer pass the `instructions` parameter.

These changes will ensure that the OpenAI agent sends requests to the `/v1/responses` endpoint in the correct multi-turn chat format.

**Files to be modified:**
- `openai-agent/src/main.ts`

```typescript
// openai-agent/src/main.ts
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
type Message = { role: 'system' | 'user' | 'assistant'; content: string };

// --- API Interaction (OpenAI Responses API) ---
async function buildRequestBody(systemInstructions: string): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<DataEntry>(
    'SELECT file_path, file_content FROM data ORDER BY id ASC'
  );

  const messages: Message[] = [];

  // Add system instructions if provided
  if (systemInstructions) {
    messages.push({ role: 'system', content: systemInstructions });
  }

  // Initial user message
  messages.push({
    role: 'user',
    content: 'I need your help on this project.',
  });

  // Add file context as a multi-turn conversation
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

  // Add a conversational turn if no files and no prompt yet
  if (!dataEntries.length && !prompt) {
    messages.push({
      role: 'assistant',
      content: 'How would you like to proceed with this project?',
    });
  }

  // Add the user's prompt as the final turn
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
    input: messages, // Responses API uses 'input' as an array of messages for multi-turn
    max_output_tokens: 1024 * 96,
    // The Responses API does not support the "temperature" parameter, so it must be removed.
    // It was not explicitly present in the original requestBody, so no direct removal needed here.
  };
}

function postToOpenAI(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = 'https://api.openai.com/v1/responses';
  requestBody.model = model;
  // requestBody.instructions is no longer set here; it's part of the 'input' array as a system message.

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

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  try {
    const requestBody = await buildRequestBody(instructions); // Pass system instructions to buildRequestBody
    const apiResponse = await postToOpenAI(requestBody, apiKey, model); // No instructions parameter here
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

GoogleAI gemini-2.5-flash (12.7k in, 1.83k out)



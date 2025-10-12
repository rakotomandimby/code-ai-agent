# Convert OpenAI request body to multi-turn chat format

Current resquest body sent to OpenAI API is not multi-turn chat.
But request body sent to Anthropics and GoogleAI are multi-turn chat.

I want to convert the request body sent to OpenAI API to multi-turn chat.

Tell me the full new content of the files I need to modify in order to achieve sending multi-turn chat request body to OpenAI API.



# ANT Convert OpenAI Agent to Multi-Turn Chat Format

I need to modify the OpenAI agent to use a multi-turn chat conversation format similar to the Anthropic and Google AI agents, instead of the current single markdown document approach. This will align the OpenAI agent's request body structure with the other agents while maintaining compatibility with the OpenAI Responses API.

The OpenAI Responses API accepts an `input` field that can be either a string or an array of message objects. I will convert the current implementation to use an array of messages with roles (system, user, assistant) to support multi-turn conversations.

## Files being modified:

1. `./code-ai-agent/openai-agent/src/main.ts`

---

## Full content of `./code-ai-agent/openai-agent/src/main.ts`:

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
type Message = { role: 'system' | 'user' | 'assistant'; content: string };

// --- API Interaction (OpenAI Responses API) ---
async function buildRequestBody(systemInstructions: string): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<DataEntry>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const input: Message[] = [];

  // Add system message if provided
  if (systemInstructions) {
    input.push({
      role: 'system',
      content: systemInstructions,
    });
  }

  // Start the conversation
  input.push({
    role: 'user',
    content: 'I need your help on this project.',
  });

  // Add file exchanges
  for (const entry of dataEntries) {
    input.push({
      role: 'assistant',
      content: `Please provide the content of the \`${entry.file_path}\` file.`,
    });
    input.push({
      role: 'user',
      content: `Here is the content of the \`${entry.file_path}\` file:\n\`\`\`\n${entry.file_content}\n\`\`\`\n`,
    });
  }

  // Handle case where no files and no prompt
  if (!dataEntries.length && !prompt) {
    input.push({
      role: 'assistant',
      content: 'How would you like to proceed with this project?',
    });
  }

  // Add prompt if provided
  if (prompt) {
    input.push({
      role: 'assistant',
      content: 'What would you like to do next?',
    });
    input.push({
      role: 'user',
      content: prompt,
    });
  }

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
    const requestBody = await buildRequestBody(instructions);
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

## Explanation:

I modified the `buildRequestBody` function to construct a multi-turn chat conversation format instead of a single markdown document:

1. **Message Array Structure**: The `input` field is now an array of `Message` objects with `role` and `content` properties, matching the format used by Anthropic and Google AI agents.

2. **System Instructions**: System instructions are now added as the first message in the conversation with the `system` role, rather than being passed separately in the `instructions` field of the request body.

3. **Conversation Flow**: The conversation follows the same pattern as the other agents:
   - User initiates: "I need your help on this project."
   - Assistant requests each file
   - User provides each file content
   - Assistant asks "What would you like to do next?" (if prompt exists)
   - User provides the prompt

4. **Type Definitions**: Added `Message` type to match the structure used in Anthropic and Google AI agents.

5. **Consistency**: The structure now aligns with the Anthropic and Google AI agents, making the codebase more consistent and maintainable.

Note: According to the OpenAI Responses API documentation you provided, the `input` field supports both string and array formats. The `instructions` field is still used in the `postToOpenAI` function to provide high-level developer instructions that are prioritized ahead of other message types.

Anthropic claude-sonnet-4-5-20250929 (13.5k in, 1.78k out)



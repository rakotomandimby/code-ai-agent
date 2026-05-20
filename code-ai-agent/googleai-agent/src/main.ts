import axios from 'axios';
import * as db from './db';
import { setDbStore, createApp, createPromptHandler, startServer } from '@code-ai-agent/lib';

const port = process.env.PORT ? Number(process.env.PORT) : 5010;

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
type Step = { type: 'user_input' | 'model_output'; content: Array<{ type: 'text'; text: string }> };

// --- API Interaction ---
async function buildRequestBody(instructions: string, model: string): Promise<any> {
  const promptRecord = await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']);
  const prompt = promptRecord?.value?.trim() ?? '';
  const dataEntries = await db.all<DataEntry>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const input: Step[] = [];

  input.push({
    type: 'user_input',
    content: [{ type: 'text', text: 'I need your help on this project.' }],
  });

  for (const entry of dataEntries) {
    input.push({
      type: 'model_output',
      content: [{ type: 'text', text: `Please provide the content of the \`${entry.file_path}\` file.` }],
    });
    input.push({
      type: 'user_input',
      content: [
        {
          type: 'text',
          text: `Here is the content of the \`${entry.file_path}\` file:\n\`\`\`\n${entry.file_content}\n\`\`\`\n`,
        },
      ],
    });
  }

  if (!dataEntries.length && !prompt) {
    input.push({
      type: 'model_output',
      content: [{ type: 'text', text: 'How would you like to proceed with this project?' }],
    });
  }

  if (prompt) {
    input.push({
      type: 'model_output',
      content: [{ type: 'text', text: 'What would you like to do next?' }],
    });
    input.push({
      type: 'user_input',
      content: [{ type: 'text', text: prompt }],
    });
  }

  const lastMessage = input[input.length - 1];
  if (!lastMessage || lastMessage.type !== 'user_input') {
    input.push({
      type: 'user_input',
      content: [{ type: 'text', text: 'Please let me know how you would like to proceed.' }],
    });
  }

  const requestBody: any = {
    model,
    input,
    generation_config: {
      temperature: 0.7,
      top_p: 0.9
    },
  };

  if (model === 'gemini-3.5-flash') {
    requestBody.generation_config.thinkingConfig = {
      thinkingLevel: 'HIGH'
    };
  }

  const sanitizedInstructions = instructions.trim();
  if (sanitizedInstructions) {
    requestBody.system_instruction = sanitizedInstructions;
  }

  return requestBody;
}

function postToGoogleAI(requestBody: any, apiKey: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/interactions`;
  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': '2026-05-20',
    },
  });
}

function createErrorResponse(errorMessage: string): any {
  return {
    steps: [
      {
        type: 'model_output',
        content: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
      },
    ],
    usage: {
      total_tokens: 0,
    },
  };
}

async function processPrompt(apiKey: string, model: string, instructions: string): Promise<any> {
  try {
    const requestBody = await buildRequestBody(instructions, model);
    const apiResponse = await postToGoogleAI(requestBody, apiKey);
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


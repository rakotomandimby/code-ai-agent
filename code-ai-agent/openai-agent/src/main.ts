import axios from 'axios';
import * as db from './db';
import {
  setDbStore,
  createApp,
  createPromptHandler,
  startServer,
  buildConversationMessages,
  createGenericProcessPrompt,
} from '@code-ai-agent/lib';

const port = process.env.PORT ? Number(process.env.PORT) : 4010;

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

async function buildRequestBody(): Promise<any> {
  const conversationMessages = await buildConversationMessages();

  return {
    input: conversationMessages.map(({ role, content }) => ({
      role,
      content,
    })),
    max_output_tokens: 1024 * 96,
  };
}

function postToOpenAI(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = 'https://api.openai.com/v1/responses';

  requestBody.model = model;

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

async function prepareAndPostToOpenAI(requestBody: any, apiKey: string, model: string) {
  return postToOpenAI(requestBody, apiKey, model);
}

const processPrompt = createGenericProcessPrompt(
  'OpenAI',
  async (instructions: string) => {
    const body = await buildRequestBody();
    const sanitizedInstructions = instructions.trim();
    if (sanitizedInstructions) {
      body.instructions = sanitizedInstructions;
    }
    return body;
  },
  prepareAndPostToOpenAI,
  createErrorResponse
);

const handlePrompt = createPromptHandler(processPrompt, 'OpenAI');
const app = createApp(handlePrompt, 'OpenAI');

startServer(app, port, db.removeDatabaseFile);


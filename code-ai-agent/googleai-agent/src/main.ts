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

const port = process.env.PORT ? Number(process.env.PORT) : 5010;

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

type Step = { type: 'user_input' | 'model_output'; content: Array<{ type: 'text'; text: string }> };

async function buildRequestBody(instructions: string, model: string): Promise<any> {
  const conversationMessages = await buildConversationMessages();

  const input: Step[] = conversationMessages.map((msg) => ({
    type: msg.role === 'user' ? 'user_input' : 'model_output',
    content: [{ type: 'text', text: msg.content }],
  }));

  const requestBody: any = {
    model,
    input,
    generation_config: {
      temperature: 0.7,
      top_p: 0.9,
    },
  };

  if (model === 'gemini-3.5-flash-minimal') { requestBody.model = 'gemini-3.5-flash'; requestBody.generation_config.thinking_level = 'minimal'; }
  if (model === 'gemini-3.6-flash-minimal') { requestBody.model = 'gemini-3.6-flash'; requestBody.generation_config.thinking_level = 'minimal'; }

  if (model === 'gemini-3.5-flash-low') { requestBody.model = 'gemini-3.5-flash'; requestBody.generation_config.thinking_level = 'low'; }
  if (model === 'gemini-3.6-flash-low') { requestBody.model = 'gemini-3.6-flash'; requestBody.generation_config.thinking_level = 'low'; }

  if (model === 'gemini-3.5-flash-medium') { requestBody.model = 'gemini-3.5-flash'; requestBody.generation_config.thinking_level = 'medium'; }
  if (model === 'gemini-3.6-flash-medium') { requestBody.model = 'gemini-3.6-flash'; requestBody.generation_config.thinking_level = 'medium'; }

  if (model === 'gemini-3.5-flash-high') { requestBody.model = 'gemini-3.5-flash'; requestBody.generation_config.thinking_level = 'high'; }
  if (model === 'gemini-3.6-flash-high') { requestBody.model = 'gemini-3.6-flash'; requestBody.generation_config.thinking_level = 'high'; }

  if (model === 'gemini-3.5-flash') { requestBody.generation_config.thinking_level = 'low'; }
  if (model === 'gemini-3.6-flash') { requestBody.generation_config.thinking_level = 'low'; }

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

const processPrompt = createGenericProcessPrompt(
  'Google AI',
  buildRequestBody,
  postToGoogleAI,
  createErrorResponse
);

const handlePrompt = createPromptHandler(processPrompt, 'GoogleAI');
const app = createApp(handlePrompt, 'GoogleAI');

startServer(app, port, db.removeDatabaseFile);


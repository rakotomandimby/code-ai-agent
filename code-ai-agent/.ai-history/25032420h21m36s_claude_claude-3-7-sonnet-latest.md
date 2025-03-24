# If the model to use is the string "disabled", just return a JSON response saying that the model is disabled

For each of the models (Anthropic, OpenAI, Gemini), if the model to be used is the string "disabled", 
I want to return a JSON response saying that the model is disabled.
The returned JSON must match the response format of the model.

Tell me the modifications I have to make in the code to achieve this.



# This is claude-3-7-sonnet-latest answer (15k in, 2k out)

# Implementing "disabled" Model Response Feature

To implement the feature where a "disabled" model returns a specific JSON response, we need to modify the `AIHttpClient` class and update the agent body classes for each provider.

## 1. First, let's update the `lib/src/ai-http-client.ts` file:

```typescript
import axios, { AxiosError } from 'axios';

export class AIHttpClient {
  protected provider: string;
  protected url: string;
  protected body: object;
  protected model: string | undefined;
  protected token: string;
  protected tokenHeaderName: string;
  protected tokenHeaderValue: string;
  protected apiVersionHeaderName: string;
  protected apiVersionHeaderValue: string;

  constructor(provider: string) {
    this.provider = provider;
    this.body = {};
    this.url = '';
    this.token = '';
    this.tokenHeaderName = '';
    this.tokenHeaderValue = '';
    this.apiVersionHeaderName = '';
    this.apiVersionHeaderValue = '';
    this.model = undefined;
  }

  setBody(body: object) {
    this.body = body;
  }
  setModel(model: string) {
    this.model = model;
  }

  async post(): Promise<Object> {
    // New code: Check if model is "disabled" and return appropriate response
    if (this.model === 'disabled') {
      return this.getDisabledModelResponse();
    }
    
    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      // if this.provider is 'anthropic', set the api version headers
      if (this.provider === 'anthropic') {
        axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
      }
      if (this.provider === 'gemini' && this.model) {
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      }

      const response = await axios.post(this.url, this.body);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.error(`HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`Response body: ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          console.error('No response received from the server');
        } else {
          console.error('Error setting up the request');
        }
      } else {
        console.error('Non-Axios error occurred:', error);
      }
      throw error;
    }
  }

  // New method to handle disabled model responses based on provider
  protected getDisabledModelResponse(): Object {
    if (this.provider === 'chatgpt') {
      return {
        id: "model-disabled",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "disabled",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "This model is currently disabled."
            },
            logprobs: null,
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        system_fingerprint: "disabled"
      };
    } else if (this.provider === 'gemini') {
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "This model is currently disabled."
                }
              ],
              role: "model"
            },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_HARASSMENT",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                probability: "NEGLIGIBLE"
              }
            ]
          }
        ],
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0
        }
      };
    } else if (this.provider === 'anthropic') {
      return {
        id: "msg_disabled",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "This model is currently disabled."
          }
        ],
        model: "disabled",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };
    }
    
    // Generic fallback response
    return {
      status: "disabled",
      message: "This model is currently disabled."
    };
  }

  protected initClient() {
    if (this.provider === 'chatgpt') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.token = process.env.OPENAI_API_KEY ?? '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
    } else if (this.provider === 'gemini') {
      this.token = process.env.GEMINI_API_KEY ?? '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
    } else if (this.provider === 'anthropic') {
      this.url = 'https://api.anthropic.com/v1/messages';
      this.token = process.env.ANTHROPIC_API_KEY ?? '';
      this.tokenHeaderName = 'x-api-key';
      this.tokenHeaderValue = this.token;
      this.apiVersionHeaderName = 'anthropic-version';
      this.apiVersionHeaderValue = '2023-06-01';
    }
  }
}
```

## 2. Now let's update the `agent-router.ts` file to handle the disabled model case:

```typescript
import express from 'express';
import { Request, Response, Router } from 'express';
import { Chunk, BaseRepository } from '@code-ai-agent/lib'; // Import from lib index
import { AIHttpClient } from './ai-http-client'; // Adjust import as necessary

export function createAgentRouter(
  repository: BaseRepository,
  agentName: string,
  aiHttpClientConstructor: { new (): AIHttpClient },
  agentBodyConstructor: { new (): any }
): Router {
  const router: Router = express.Router();
  let counter: number = 1000;

  router.get('/', (req: Request, res: Response) => {
    res.send('Hello from shared router!');
  });

  router.get(`/${agentName}/clear`, async (req: Request, res: Response) => {
    await repository.clear();
    res.send({});
  });

  router.post(`/${agentName}`, async (req: Request, res: Response) => {
    await repository.init();
    let JSONBody = req.body;

    const handleProperty = async (propertyName: string) => {
      counter++;
      if (JSONBody[propertyName]) {
        let chunk = new Chunk(propertyName, counter, '', JSONBody[propertyName]);
        await repository.save(chunk);
      }
    };

    await Promise.all([
      handleProperty('system_instruction'),
      handleProperty('model_to_use'),
      handleProperty('temperature'),
      handleProperty('top_p'),
    ]);

    if (JSONBody.role && JSONBody.content) {
      counter++;
      let chunk = new Chunk('message', counter, JSONBody.role, JSONBody.content);
      await repository.save(chunk);
    }

    if (Object.keys(JSONBody).length === 0) {
      setTimeout(async () => {
        try {
          const agentBody = new agentBodyConstructor();

          const modelToUse = await repository.getModelToUse();
          agentBody.setModelToUse(modelToUse);

          const multiTurnText = await repository.getMultiTurnChat();
          agentBody.setMultiTurnChat(multiTurnText);

          const systemInstruction = await repository.getSystemInstruction();
          agentBody.setSystemInstruction(systemInstruction);

          const temperature = await repository.getTemperature();
          agentBody.setTemperature(parseFloat(temperature));

          const topP = await repository.getTopP();
          agentBody.setTopP(parseFloat(topP));
          
          console.log(`>>>>> ${agentName} ${modelToUse} has been queried`);
          
          const aiHttpClient = new aiHttpClientConstructor();
          aiHttpClient.setBody(agentBody.getBody());
          aiHttpClient.setModel(modelToUse); // Pass the model here
          
          const response = await aiHttpClient.post();
          res.send(response);
          
          // If model is disabled, log accordingly, otherwise use standard log
          if (modelToUse === 'disabled') {
            console.log(`<<<<< ${agentName} ${modelToUse} - Response for disabled model sent`);
          } else {
            console.log(`<<<<< ${agentName} ${modelToUse} has responded`);
          }
          
          await repository.clear();
        } catch (err) {
          res.status(500).send(err);
          await repository.clear();
        }
      }, 1000);
    } else {
      res.send({});
    }
  });

  return router;
}
```

## 3. (Optional) Let's make sure the agent body classes correctly handle the "disabled" state:

While not strictly necessary since our main handling is in the AIHttpClient class, we could ensure each agent body class properly handles the "disabled" state. Here's an example for the ChatGPT body:

```typescript
// For chatgpt-agent/src/model/chatgpt-body.ts
public getBody() {
  // Special case handling for disabled model (redundant but consistent)
  if(this.model === 'disabled') {
    return {
      messages: this.chunks,
      model: this.model
    };
  }
  
  // Original code remains the same...
  if(this.model.startsWith('o1') || this.model.startsWith('o3')){
    return {
      messages: this.chunks,
      model: this.model,
    }
  } else{
    return {
      messages: this.chunks,
      model: this.model,
      temperature: this.temperature,
      top_p: this.topP,
    }
  }
}
```

Similarly, we could update the Gemini and Anthropic body classes in the same way.

## Summary of Changes

1. Added the `getDisabledModelResponse()` method to the `AIHttpClient` class which returns provider-specific mock responses when the model is 'disabled'.
2. Modified the `post()` method to check if the model is 'disabled' and return the appropriate response format without making an API call.
3. Updated the logging in the `createAgentRouter` function to show a more specific message when a disabled model is used.

These changes ensure that when a model is set to "disabled", the system will return a properly formatted response that mimics the structure of a real response from that provider without actually making any API calls.


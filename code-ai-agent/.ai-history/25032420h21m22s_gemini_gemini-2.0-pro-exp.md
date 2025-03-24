# If the model to use is the string "disabled", just return a JSON response saying that the model is disabled

For each of the models (Anthropic, OpenAI, Gemini), if the model to be used is the string "disabled", 
I want to return a JSON response saying that the model is disabled.
The returned JSON must match the response format of the model.

Tell me the modifications I have to make in the code to achieve this.



# This is gemini-2.0-pro-exp answer (14k in, 1k out)

Here's how you can modify the code to handle the "disabled" model scenario and return the appropriate JSON response for each agent:

**1. Update `lib/src/agent-router.ts`**

Modify the `agent-router.ts` file to check for the "disabled" model and return a specific JSON response.

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
          const modelToUse = await repository.getModelToUse();

          // Check if the model is disabled
          if (modelToUse === 'disabled') {
            let disabledResponse;
            if (agentName === 'chatgpt') {
              disabledResponse = {
                "id": `disabled-${Date.now()}`,
                "object": "chat.completion",
                "created": Date.now(),
                "model": "disabled",
                "choices": [
                  {
                    "index": 0,
                    "message": {
                      "role": "assistant",
                      "content": "This model is currently disabled.",
                    },
                    "logprobs": null,
                    "finish_reason": "stop"
                  }
                ],
                "usage": {
                  "prompt_tokens": 0,
                  "completion_tokens": 0,
                  "total_tokens": 0
                },
                "system_fingerprint": "disabled"
              };
            } else if (agentName === 'anthropic') {
              disabledResponse = {
                "id": `disabled-${Date.now()}`,
                "type": "message",
                "role": "assistant",
                "content": [
                  {
                    "type": "text",
                    "text": "This model is currently disabled."
                  }
                ],
                "model": "disabled",
                "stop_reason": "stop_sequence",
                "stop_sequence": null,
                "usage": {
                  "input_tokens": 0,
                  "output_tokens": 0
                }
              };
            } else if (agentName === 'gemini') {
              disabledResponse = {
                "candidates": [
                  {
                    "content": {
                      "parts": [
                        {
                          "text": "This model is currently disabled.",
                        }
                      ],
                      "role": "model"
                    },
                    "finishReason": "STOP",
                    "index": 0,
                    "safetyRatings": [
                      {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "probability": "NEGLIGIBLE"
                      },
                      {
                        "category": "HARM_CATEGORY_HATE_SPEECH",
                        "probability": "NEGLIGIBLE"
                      },
                      {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "probability": "NEGLIGIBLE"
                      },
                      {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "probability": "NEGLIGIBLE"
                      }
                    ]
                  }
                ],
                "usageMetadata": {
                  "promptTokenCount": 0,
                  "candidatesTokenCount": 0,
                  "totalTokenCount": 0
                }
              };
            }
            res.send(disabledResponse);
            console.log(`>>>>> ${agentName} ${modelToUse} is disabled`);
            await repository.clear();
            return; // Important: Exit the function after sending the response
          }


          const agentBody = new agentBodyConstructor();

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
          console.log(`<<<<< ${agentName} ${modelToUse} has responded`);
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

Key changes:

-   **Check for "disabled" model:**  Inside the `setTimeout` callback, *before* creating the `agentBody`, we now check:
    ```typescript
    if (modelToUse === 'disabled') {
        // ... construct disabledResponse ...
        res.send(disabledResponse);
        await repository.clear();
        return; //  Exit the function!
    }
    ```
-   **Disabled Response Construction:**  We create a `disabledResponse` object, structured according to the expected response format of each agent (ChatGPT, Anthropic, Gemini).  I've used the provided `chatgpt-response.json`, `gemini-response.json` and the `AnthropicBody` class to create these.  The key parts are:
    -   Setting appropriate fields like `id`, `object`, `created`, `model` to indicate a disabled state.
    -   Including a message like "This model is currently disabled." in the `content` field.
    -   Setting usage tokens to 0.
- **Agent-Specific Responses**: The code now includes an `if/else if` block to generate the correct "disabled" response format for `chatgpt`, `anthropic`, and `gemini`.
-   **`return;` after sending:**  The `return;` statement is *crucially important*.  It prevents the rest of the code (which would try to call the AI) from executing.  Without this, you'd get an error because you'd be trying to send two responses to the same request.
- **Logging**: Added a log message to indicate that the disabled model has been triggered.

This revised code directly addresses the requirement of returning a specific JSON response when the model is "disabled," and it does so in a way that's consistent with the structure of your existing code. It also handles the different response formats for each of the three AI agents. It also clears the repository, as the original code does.


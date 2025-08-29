import express from 'express';
import { Request, Response, Router } from 'express';
import { Chunk, BaseRepository } from '@code-ai-agent/lib';
import { AIHttpClient } from './ai-http-client';

export function createAgentRouter(
  repository: BaseRepository,
  agentName: string,
  aiHttpClientConstructor: { new (): AIHttpClient },
  agentBodyConstructor: { new (): any }
): Router {
  const router: Router = express.Router();
  let counter: number = 1000;
  let apiKey: string | null = null; // Store API key in memory for the request cycle

  router.get('/', (req: Request, res: Response) => {
    res.send('Hello from shared router!');
  });

  router.get(`/${agentName}/clear`, async (req: Request, res: Response) => {
    await repository.clear();
    apiKey = null; // Also clear the API key
    res.send({});
  });

  router.post(`/${agentName}`, async (req: Request, res: Response) => {
    await repository.init();
    const JSONBody = req.body;

    // Capture the API key if provided and remove it from the body
    if (JSONBody['api_key']) {
      apiKey = JSONBody['api_key'];
    }

    const handleProperty = async (propertyName: string) => {
      counter++;
      if (JSONBody[propertyName]) {
        const chunk = new Chunk(propertyName, counter, '', JSONBody[propertyName]);
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
      const chunk = new Chunk('message', counter, JSONBody.role, JSONBody.content);
      await repository.save(chunk);
    }

    if (Object.keys(JSONBody).length === 0) {
      setTimeout(async () => {
        try {
          const agentBody = new agentBodyConstructor();

          const modelToUse = await repository.getModelToUse();
          agentBody.setModelToUse(modelToUse);

          const systemInstruction = await repository.getSystemInstruction();
          agentBody.setSystemInstruction(systemInstruction);

          const multiTurnText = await repository.getMultiTurnChat();
          agentBody.setMultiTurnChat(multiTurnText);

          const temperature = await repository.getTemperature();
          agentBody.setTemperature(parseFloat(temperature));

          const topP = await repository.getTopP();
          agentBody.setTopP(parseFloat(topP));

          console.log(`>>>>> ${agentName} ${modelToUse} has been queried`);

          // --- Start timing here ---
          const startTime = Date.now();

          const aiHttpClient = new aiHttpClientConstructor();
          aiHttpClient.setApiKey(apiKey); // Pass the stored API key
          aiHttpClient.setBody(agentBody.getBody());
          aiHttpClient.setModel(modelToUse);

          const response = await aiHttpClient.post();

          // --- End timing here ---
          const endTime = Date.now();
          const durationMs = endTime - startTime;
          const durationSec = (durationMs / 1000).toFixed(2);
          res.send(response);

          if (modelToUse === 'disabled') {
            console.log(`<<<<< ${agentName} ${modelToUse} - Response for disabled model sent (took ${durationSec} s)`);
          } else {
            console.log(`<<<<< ${agentName} ${modelToUse} has responded (took ${durationSec} s)`);
          }

          apiKey = null; // Clear API key after use
          await repository.clear();
        } catch (err) {
          apiKey = null; // Clear API key on error
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


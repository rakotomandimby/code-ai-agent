import express from 'express';
import { Request, Response, Router } from 'express';
import { Chunk, BaseRepository } from '@code-ai-agent/lib'; // Import from lib index
import { AIHttpClient } from './ai-http-client'; // Adjust import as necessary
import { MultiTurnChat } from './multi-turn-chat'; // Adjust import as necessary

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
      if (JSONBody[propertyName]) {
        counter++;
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
          const multiTurnText = await repository.getMultiTurnChat();
          agentBody.setMultiTurnChat(multiTurnText);

          const systemInstruction = await repository.getSystemInstruction();
          agentBody.setSystemInstruction(systemInstruction);

          const modelToUse = await repository.getModelToUse();
          agentBody.setModelToUse(modelToUse);

          const temperature = await repository.getTemperature();
          agentBody.setTemperature(parseFloat(temperature));

          const topP = await repository.getTopP();
          agentBody.setTopP(parseFloat(topP));

          const aiHttpClient = new aiHttpClientConstructor();
          aiHttpClient.setBody(agentBody.getBody());
          const response = await aiHttpClient.post();
          res.send(response);
        } catch (err) {
          res.status(500).send(err);
        }
      }, 1000);
    } else {
      res.send({});
    }
  });

  return router;
}

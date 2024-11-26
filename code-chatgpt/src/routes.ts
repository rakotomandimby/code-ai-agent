import express, { Request, Response, Router } from 'express';
import ChatGPTRepository from './repository/chatgpt-repository';
import Chunk from './model/chunk';
import AIHttpClient from './ai-http-client';
import ChatGPTBody from './model/chatgpt-body';

const router: Router = express.Router();
let counter: number = 1000;

router.get('/', (req: Request, res: Response) => {
  res.send('Lorem Ipsum');
});
router.get('/chatgpt/clear', async (req: Request, res: Response) => {
  let chatGPTRepository = new ChatGPTRepository();
  await chatGPTRepository.clear();
  await chatGPTRepository.close();
  res.send({});
  res.end();
});

router.post('/chatgpt', async (req: Request, res: Response) => {
  counter++;
  let repository = new ChatGPTRepository();
  await repository.init();
  let JSONBody = req.body;
  if (JSONBody.system_instruction) {
    let chunk = new Chunk('system_instruction', counter, '', JSONBody.system_instruction);
    await repository.save(chunk);
    res.send({}); 
    res.end();
  }
  if (JSONBody.model_to_use) {
    let chunk = new Chunk('model_to_use', counter, '', JSONBody.model_to_use);
    await repository.save(chunk);
    res.send({});
    res.end();
  }
  if (JSONBody.temperature) {
    let chunk = new Chunk('temperature', counter, '', JSONBody.temperature);
    await repository.save(chunk);
    res.send({});
    res.end();
  }
  if (JSONBody.top_p) {
    let chunk = new Chunk('top_p', counter, '', JSONBody.top_p);
    await repository.save(chunk);
    res.send({});
    res.end();
  }
  if (JSONBody.role && JSONBody.content) {
    let chunk = new Chunk('message', counter, JSONBody.role, JSONBody.content);
    await repository.save(chunk);
    res.send({});
    res.end();
  }

  if (JSONBody.length === 0) {
    setTimeout(async () => {
      try {
        let b = new ChatGPTBody();
        let mtt = await repository.getMultiTurnChat();
        b.setMultiTurnChat(mtt);

        let si = await repository.getSystemInstruction();
        b.setSystemInstruction(si);

        let mtu = await repository.getModelToUse();
        b.setModelToUse(mtu);

        let t = await repository.getTemperature();
        b.setTemperature(parseFloat(t));

        let tp = await repository.getTopP();
        b.setTopP(parseFloat(tp));

        let aiHttpClient = new AIHttpClient('chatgpt');
        aiHttpClient.setBody(b.getBody());
        let response = await aiHttpClient.post();
        res.send(response);
      } catch (err) {
        res.status(500).send(err);
      } finally {
        res.end();
      }
    }, 1000); // Delay of 1000 milliseconds (3 seconds)
  }
});

export default router;

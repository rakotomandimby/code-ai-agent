import express, { Request, Response, Router } from 'express';
import GeminiRepository from './repository/gemini-repository';
import Chunk from './model/chunk';
import AIHttpClient from './ai-http-client';
import GeminiBody from './model/gemini-body';

const router: Router = express.Router();
let counter: number = 1000;

router.get('/', (req: Request, res: Response) => {
  res.send('Lorem Ipsum');
});
router.get('/gemini/clear', async (req: Request, res: Response) => {
  let geminiRepository = new GeminiRepository();
  await geminiRepository.clear();
  await geminiRepository.close();
  res.send({});
  res.end();
});

router.post('/gemini', async (req: Request, res: Response) => {
  counter++;
  let repository = new GeminiRepository();
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
    try {
      let b = new GeminiBody();
      let mtt = await repository.getMultiTurnChat();
      b.setMultiTurnChat(mtt);

      let si = await repository.getSystemInstruction();
      b.setSystemInstruction(si);

      let t = await repository.getTemperature();
      b.setTemperature(parseFloat(t));

      let tp = await repository.getTopP();
      b.setTopP(parseFloat(tp));

      let aiHttpClient = new AIHttpClient('gemini');
      aiHttpClient.setBody(b.getBody());
      let response = await aiHttpClient.post();
      res.send(response);
    } catch (err) {
      res.status(500).send(err);
    } finally {
      res.end();
    }
  }
});

export default router;

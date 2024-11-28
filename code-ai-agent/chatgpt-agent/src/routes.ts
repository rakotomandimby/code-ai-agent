import express, { Router } from 'express';
import ChatGPTRepository from './repository/chatgpt-repository';
import { ChatGPTAIHttpClient } from './ai-http-client';
import { createAgentRouter } from '@code-ai-agent/lib'; // Adjust import as necessary
import ChatGPTBody from './model/chatgpt-body';

const router: Router = createAgentRouter(
  new ChatGPTRepository(),
  'chatgpt',
  ChatGPTAIHttpClient,
  ChatGPTBody // Adjust as necessary
);

export default router;

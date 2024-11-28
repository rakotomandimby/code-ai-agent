import express, { Router } from 'express';
import GeminiRepository from './repository/gemini-repository';
import { GeminiAIHttpClient } from './ai-http-client';
import { createAgentRouter } from '@code-ai-agent/lib'; // Adjust import as necessary
import GeminiBody from './model/gemini-body';

const router: Router = createAgentRouter(
  new GeminiRepository(),
  'gemini',
  GeminiAIHttpClient,
  GeminiBody // Adjust as necessary
);

export default router;

import express, { Router } from 'express';
import OpenAIRepository from './repository/openai-repository';
import { OpenAIAIHttpClient } from './ai-http-client';
import { createAgentRouter } from '@code-ai-agent/lib';
import OpenAIBody from './model/openai-body';

const router: Router = createAgentRouter(
  new OpenAIRepository(),
  'openai',
  OpenAIAIHttpClient,
  OpenAIBody
);

export default router;

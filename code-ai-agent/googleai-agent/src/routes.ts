import express, { Router } from 'express';
import GoogleAIRepository from './repository/googleai-repository';
import { GoogleAIAIHttpClient } from './ai-http-client';
import { createAgentRouter } from '@code-ai-agent/lib';
import GoogleAIBody from './model/googleai-body';

const router: Router = createAgentRouter(
  new GoogleAIRepository(),
  'googleai',
  GoogleAIAIHttpClient,
  GoogleAIBody
);

export default router;

import express, { Router } from 'express';
import AnthopicRepository from './repository/anthropic-repository';
import { AnthropicAIHttpClient } from './ai-http-client';
import { createAgentRouter } from '@code-ai-agent/lib'; // Adjust import as necessary
import AnthropicBody from './model/anthropic-body';
import AnthropicRepository from './repository/anthropic-repository';

const router: Router = createAgentRouter(
  new AnthropicRepository(),
  'anthropic',
  AnthropicAIHttpClient,
  AnthropicBody // Adjust as necessary
);

export default router;

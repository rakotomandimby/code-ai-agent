# Fix the "PayloadTooLargeError" error when body is large

When POSTing large payloads to the agents, I get the following error:

```
Error processing request: PayloadTooLargeError: request entity too large
```

I get this on all 3 agents.

Analyze the code and propose a fix for this issue.
It might just be a setting that needs to be changed in a variable or configuration file.
Tell me the **full new content** of the files I need to change to fix this issue.


# GGL Increase Express JSON body limit

I implement this fix by configuring the `express.json()` middleware with a higher limit (50mb) in the shared library. This change ensures that all agents (OpenAI, GoogleAI, and Anthropic) can accept large payloads without throwing a `PayloadTooLargeError`.

Here are the files that are being modified:

- `code-ai-agent/lib/src/lib/express-app.ts`

### `code-ai-agent/lib/src/lib/express-app.ts`

```typescript
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { RequestBody, handleConfig, handleFile, PromptHandler } from './express-handlers';

export function createApp(handlePrompt: PromptHandler, apiName: string): express.Application {
  const app = express();
  // Increase the body limit to 50mb to handle large file payloads
  app.use(express.json({ limit: '50mb' }));

  app.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body as RequestBody;
      switch (type) {
        case 'api key':
          console.log(`>>>> Request received on ${apiName}`);
          await handleConfig(req, res);
          break;
        case 'system instructions':
        case 'model':
          await handleConfig(req, res);
          break;
        case 'file':
          await handleFile(req, res);
          break;
        case 'prompt':
          await handlePrompt(req, res);
          break;
        default:
          res.status(400).json({ error: `Invalid type specified: ${type}` });
      }
    } catch (error) {
      next(error);
    }
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error processing request:', err);
    if (axios.isAxiosError(err) && err.response) {
      console.error(`Error calling ${apiName} API:`, err.response.data);
      return res.status(500).json({
        error: `Failed to process prompt with ${apiName} API`,
        details: err.response.data
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
```

GoogleAI gemini-3-pro-preview (13.2k in, 584 out)



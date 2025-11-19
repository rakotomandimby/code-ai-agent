# Fix the "PayloadTooLargeError" error when body is large

When POSTing large payloads to the agents, I get the following error:

```
Error processing request: PayloadTooLargeError: request entity too large
```

I get this on all 3 agents.

Analyze the code and propose a fix for this issue.
It might just be a setting that needs to be changed in a variable or configuration file.
Tell me the **full new content** of the files I need to change to fix this issue.


# ANT Fix the "PayloadTooLargeError" error by increasing Express body size limit

I analyze the error and identify the root cause. The `PayloadTooLargeError: request entity too large` occurs because Express has a default body size limit of 100kb for JSON payloads. When sending large file contents or prompts, this limit is easily exceeded.

The fix is to increase the body size limit in the Express configuration by passing options to the `express.json()` middleware.

## Root Cause

In `./code-ai-agent/lib/src/lib/express-app.ts`, the line:
```typescript
app.use(express.json());
```

This uses the default limit of 100kb. When posting large file contents, the request is rejected before reaching the handlers.

## Solution

I need to modify the `express.json()` middleware configuration to accept a much larger payload size. I recommend setting it to `50mb` to accommodate large file contents.

## File to modify

**File: `./code-ai-agent/lib/src/lib/express-app.ts`**

Here is the full new content of the file:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { RequestBody, handleConfig, handleFile, PromptHandler } from './express-handlers';

export function createApp(handlePrompt: PromptHandler, apiName: string): express.Application {
  const app = express();
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

## Changes made

The only change is on line 6:
- **Before:** `app.use(express.json());`
- **After:** `app.use(express.json({ limit: '50mb' }));`

This increases the maximum request body size to 50 megabytes, which should be sufficient for large file contents and prompts.

## Impact

This change affects all three agents (OpenAI, GoogleAI, and Anthropic) since they all use the shared `createApp` function from the `@code-ai-agent/lib` library. After rebuilding the lib and the agents, all three will accept larger payloads.

## Steps to apply the fix

1. Modify `./code-ai-agent/lib/src/lib/express-app.ts` with the content above
2. Rebuild the lib: `nx build lib`
3. Rebuild all agents:
   - `nx build openai-agent`
   - `nx build googleai-agent`
   - `nx build anthropic-agent`
4. Restart the agents

The `PayloadTooLargeError` should no longer occur when posting large file contents or prompts.

Anthropic claude-sonnet-4-5 (14.1k in, 995 out)



# Error when building `lib`

When building the `lib` project, I get the following errors:

```
> nx run lib:build

Compiling TypeScript files for project "lib"...
lib/src/lib/express-app.ts:1:8 - error TS1259: Module '"/home/mihamina/Projects/RKTMB/rktmb-code-ai-agent-monorepo/code-ai-agent/node_modules/@types/express/index"' can only be default-imported using the 'esModuleInterop' flag

1 import express, { Request, Response, NextFunction } from 'express';

  node_modules/@types/express/index.d.ts:128:1
    128 export = e;
    This module is declared with 'export =', and can only be used with a default import when using the 'esModuleInterop' flag.
lib/src/lib/express-handlers.ts:55:3 - error TS2322: Type '(req: Request, res: Response) => Promise<Response<any, Record<string, any>>>' is not assignable to type 'PromptHandler'.
  Type 'Promise<Response<any, Record<string, any>>>' is not assignable to type 'Promise<void>'.
    Type 'Response<any, Record<string, any>>' is not assignable to type 'void'.

55   return async (req: Request, res: Response) => {
lib/src/lib/server.ts:1:8 - error TS1259: Module '"/home/mihamina/Projects/RKTMB/rktmb-code-ai-agent-monorepo/code-ai-agent/node_modules/@types/express/index"' can only be default-imported using the 'esModuleInterop' flag

1 import express from 'express';

  node_modules/@types/express/index.d.ts:128:1
    128 export = e;
    This module is declared with 'export =', and can only be used with a default import when using the 'esModuleInterop' flag.

```


Tell me the full new content of the files I need to modify to fix and have a running code.



# OPN Update library imports and handlers to satisfy TypeScript compilation and ensure prompt handler returns void  
I update the shared library so that it compiles without enabling `esModuleInterop`, and I adjust the prompt handler logic to always fulfill the `Promise<void>` contract while still sending the appropriate HTTP responses.

I replace the default Express import with a CommonJS-compatible form in `express-app.ts`, remove the unused runtime import in `server.ts`, and make the prompt handler emit responses without returning the Express `Response` object. These changes resolve the build errors encountered when running `nx run lib:build`.

## Modified Files
- `lib/src/lib/express-app.ts`
- `lib/src/lib/express-handlers.ts`
- `lib/src/lib/server.ts`

### `lib/src/lib/express-app.ts`
```typescript
import express = require('express');
import axios from 'axios';
import type { Request, Response, NextFunction } from 'express';
import { RequestBody, handleConfig, handleFile, PromptHandler } from './express-handlers';

export function createApp(handlePrompt: PromptHandler, apiName: string): express.Application {
  const app = express();
  app.use(express.json());

  app.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body as RequestBody;
      switch (type) {
        case 'api key':
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
      res.status(500).json({
        error: `Failed to process prompt with ${apiName} API`,
        details: err.response.data
      });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
```

### `lib/src/lib/express-handlers.ts`
```typescript
import { Request, Response } from 'express';
import * as db from './db-instance';

export interface ConfigPayload {
  type: 'api key' | 'system instructions' | 'model' | 'prompt';
  text: string;
}

export interface FilePayload {
  type: 'file';
  filename: string;
  content: string;
}

export type RequestBody = FilePayload | ConfigPayload;

export const handleConfig = async (req: Request, res: Response): Promise<void> => {
  const { type, text } = req.body as ConfigPayload;
  const keyMap = {
    'api key': 'api_key',
    'system instructions': 'system_instructions',
    model: 'model',
    prompt: 'prompt'
  } as const;
  const dbKey = keyMap[type];

  if (!text) {
    res.status(400).json({ error: `Missing text field for ${type}` });
    return;
  }

  if (type === 'api key') {
    await db.resetDatabase();
  }

  const { lastID } = await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [dbKey, text]);
  res.json({ message: `${type} stored successfully`, rowId: lastID });
};

export const handleFile = async (req: Request, res: Response): Promise<void> => {
  const { filename, content } = req.body as FilePayload;
  if (!filename || !content) {
    res.status(400).json({ error: 'Missing filename or content for file' });
    return;
  }
  const { lastID } = await db.run('INSERT INTO data (file_path, file_content) VALUES (?, ?)', [filename, content]);
  res.json({ message: 'File data stored successfully', rowId: lastID });
};

export interface PromptHandler {
  (req: Request, res: Response): Promise<void>;
}

export function createPromptHandler(
  processPrompt: (apiKey: string, model: string, instructions: string) => Promise<any>
): PromptHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const { text } = req.body as ConfigPayload;
    if (!text) {
      res.status(400).json({ error: 'Missing text field for prompt' });
      return;
    }

    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['prompt', text]);

    const apiKey = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['api_key']))?.value;
    const model = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['model']))?.value;
    const instructions =
      (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';

    if (!apiKey) {
      res.status(400).json({ error: 'API key not set' });
      return;
    }
    if (!model) {
      res.status(400).json({ error: 'Model not set' });
      return;
    }

    // Wait 3 seconds to ensure DB updates are visible
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const apiResponse = await processPrompt(apiKey, model, instructions);
    res.json(apiResponse);
  };
}
```

### `lib/src/lib/server.ts`
```typescript
import type { Application } from 'express';
import * as db from './db-instance';

export async function startServer(
  app: Application,
  port: number,
  removeDatabaseFile?: () => void
): Promise<void> {
  try {
    if (removeDatabaseFile) {
      removeDatabaseFile();
    }
    await db.connectToDatabase();
    await db.initializeDatabase();
    app.listen(port, () => {
      console.log(`[ ready ] http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

OpenAI gpt-5-codex (8734 in, 5432 out)



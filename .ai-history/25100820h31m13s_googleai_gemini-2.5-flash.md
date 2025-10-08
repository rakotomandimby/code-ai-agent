# Advise factorization if needed.

Do you identify any potentiel factorization in the given code?
I do not want to be excessively factorized, but if you see a potentiel for it, please advise me.

Tell me the full new content of the files if you think factorization is needed.


# GGL Yes, I identify significant potential for factorization in the provided codebase, particularly in the `main.ts` files of your `openai-agent` and `anthropic-agent` projects. A large amount of the Express server setup, route handling, and database interaction logic is duplicated across these agents.

The core difference between the agents lies in how they construct the request body for their respective LLM APIs (`buildRequestBody`) and how they make the actual API call (`postToXXXAI`).

I recommend creating a new shared Nx library, let's call it `@code-ai-agent/agent-core`, to encapsulate this common server logic. This will make your agent implementations much cleaner, easier to maintain, and more consistent.

### Factorization Plan:

1.  **Create a new `agent-core` library:** This library will contain the generic Express app setup, common middleware, shared type definitions, and the boilerplate route handlers.
2.  **Abstract LLM Interaction:** The `agent-core` will expose a function (e.g., `createAgentApp`) that takes agent-specific functions for `buildRequestBody` and `postToLLM` as parameters. This allows each agent to define its unique LLM interaction while reusing the common server framework.
3.  **Streamline Database Interaction:** The agent-specific `src/db.ts` files are identical except for the database file path. By creating the `SQLiteStore` instance directly in each agent's `main.ts` and passing it to the `agent-core`, these redundant `db.ts` files can be removed.
4.  **Refine LLM Request Body Handling:** The `buildRequestBody` function in each agent will now be responsible for fetching and including system instructions (if applicable to that LLM's API) directly into the request body, simplifying the `postToLLM` interface.

### Full New Content of Files:

Here are the changes, including the new `agent-core` library and updates to existing files:

---

#### 1. New File: `./code-ai-agent/agent-core/project.json`

```json
{
  "name": "agent-core",
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "agent-core/src",
  "projectType": "library",
  "tags": [],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/agent-core",
        "tsConfig": "agent-core/tsconfig.lib.json",
        "packageJson": "agent-core/package.json",
        "main": "agent-core/src/index.ts",
        "assets": ["agent-core/*.md"]
      }
    }
  }
}
```

---

#### 2. New File: `./code-ai-agent/agent-core/package.json`

```json
{
  "name": "@code-ai-agent/agent-core",
  "version": "0.0.1",
  "private": true,
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "dependencies": {
    "tslib": "^2.3.0",
    "express": "^4.17.21",
    "axios": "^1.6.0"
  },
  "peerDependencies": {
    "@code-ai-agent/lib": "*"
  }
}
```

---

#### 3. New File: `./code-ai-agent/agent-core/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs"
  },
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    }
  ]
}
```

---

#### 4. New File: `./code-ai-agent/agent-core/tsconfig.lib.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

---

#### 5. New File: `./code-ai-agent/agent-core/src/index.ts`

```typescript
export * from './lib/agent-core';
```

---

#### 6. New File: `./code-ai-agent/agent-core/src/lib/agent-core.ts`

```typescript
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { SQLiteStore } from '@code-ai-agent/lib'; // Import SQLiteStore type

// Utility delay function
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Type Definitions ---
export interface FilePayload {
  type: 'file';
  filename: string;
  content: string;
}

export interface ConfigPayload {
  type: 'api key' | 'system instructions' | 'model' | 'prompt';
  text: string;
}

export type RequestBody = FilePayload | ConfigPayload;

// --- Interface for Agent-specific functions ---
export interface AgentSpecificFunctions {
  buildRequestBody: (db: SQLiteStore) => Promise<any>;
  // postToLLM no longer takes a separate 'instructions' parameter.
  // buildRequestBody is now responsible for including system instructions in the request body.
  postToLLM: (requestBody: any, apiKey: string, model: string) => Promise<any>;
  llmProviderName: string; // e.g., 'OpenAI', 'Anthropic', 'GoogleAI'
}

export function createAgentApp(
  port: number,
  dbStore: SQLiteStore, // Pass the specific db store instance
  agentFns: AgentSpecificFunctions
) {
  const app = express();
  app.use(express.json());

  const { buildRequestBody, postToLLM, llmProviderName } = agentFns;

  // --- Route Handlers ---
  const handleConfig = async (req: Request, res: Response) => {
    const { type, text } = req.body as ConfigPayload;
    const keyMap = {
      'api key': 'api_key',
      'system instructions': 'system_instructions',
      'model': 'model',
      'prompt': 'prompt',
    };
    const dbKey = keyMap[type];

    if (!text) {
      return res.status(400).json({ error: `Missing text field for ${type}` });
    }

    if (type === 'api key') {
      await dbStore.resetDatabase();
    }

    const { lastID } = await dbStore.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [dbKey, text]);
    res.json({ message: `${type} stored successfully`, rowId: lastID });
  };

  const handleFile = async (req: Request, res: Response) => {
    const { filename, content } = req.body as FilePayload;
    if (!filename || !content) {
      return res.status(400).json({ error: 'Missing filename or content for file' });
    }
    const { lastID } = await dbStore.run('INSERT INTO data (file_path, file_content) VALUES (?, ?)', [filename, content]);
    res.json({ message: 'File data stored successfully', rowId: lastID });
  };

  const handlePrompt = async (req: Request, res: Response) => {
    const { text } = req.body as ConfigPayload;
    if (!text) {
      return res.status(400).json({ error: 'Missing text field for prompt' });
    }

    await dbStore.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['prompt', text]);

    const apiKey = (await dbStore.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['api_key']))?.value;
    const model = (await dbStore.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['model']))?.value;
    // System instructions are now fetched by buildRequestBody if needed by the LLM.

    if (!apiKey) return res.status(400).json({ error: 'API key not set' });
    if (!model) return res.status(400).json({ error: 'Model not set' });

    // Wait 3 seconds to ensure DB updates are visible before building the request body
    await delay(3000);
    const requestBody = await buildRequestBody(dbStore); // Pass dbStore to buildRequestBody
    const apiResponse = await postToLLM(requestBody, apiKey, model); // Call postToLLM without 'instructions'
    res.json(apiResponse.data);
  };

  // --- Express App Setup ---
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
      console.error(`Error calling ${llmProviderName} API:`, err.response.data);
      return res.status(500).json({ error: `Failed to process prompt with ${llmProviderName} API`, details: err.response.data });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  // --- Server Initialization ---
  async function startServer() {
    try {
      dbStore.removeDatabaseFile();
      await dbStore.connectToDatabase();
      await dbStore.initializeDatabase();
      app.listen(port, () => {
        console.log(`[ ready ] http://0.0.0.0:${port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  return { app, startServer };
}
```

---

#### 7. Updated File: `./code-ai-agent/tsconfig.base.json`

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "es2015",
    "module": "esnext",
    "lib": ["es2020", "dom"],
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@code-ai-agent/lib": ["lib/src/index.ts"],
      "@code-ai-agent/agent-core": ["agent-core/src/index.ts"] // NEW PATH
    }
  },
  "exclude": ["node_modules", "tmp"]
}
```

---

#### 8. Updated File: `./code-ai-agent/openai-agent/src/main.ts`

```typescript
import { createAgentApp, AgentSpecificFunctions } from '@code-ai-agent/agent-core';
import { createSQLiteStore, SQLiteStore } from '@code-ai-agent/lib';
import axios from 'axios';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// Initialize agent-specific DB store directly
const dbStore = createSQLiteStore('/tmp/openai_agent.db');

// --- API Interaction (OpenAI Responses API) ---
async function buildOpenAIRequestBody(db: SQLiteStore): Promise<any> {
  const prompt =
    (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<{ file_path: string; file_content: string }>(
    'SELECT file_path, file_content FROM data ORDER BY id ASC'
  );
  // Fetch system instructions here and include in the request body
  const systemInstructions = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';

  // Build a single markdown document as input
  const parts: string[] = [];

  parts.push('# Project Files');
  if (dataEntries.length === 0) {
    parts.push('_No files provided._');
  } else {
    for (const entry of dataEntries) {
      parts.push(
        `## File: ${entry.file_path}\n\n` +
          '```\n' +
          `${entry.file_content}\n` +
          '```'
      );
    }
  }

  if (prompt) {
    parts.push(`\n\n${prompt.trim()}`);
  }

  const input = parts.join('\n\n');
  return {
    input,
    max_output_tokens: 1024 * 96,
    instructions: systemInstructions || undefined // OpenAI instructions are part of the body
  };
}

// postToOpenAI now doesn't need an 'instructions' parameter, as it's handled in buildOpenAIRequestBody
function postToOpenAI(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = 'https://api.openai.com/v1/responses';
  requestBody.model = model;

  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  });
}

// Define agent-specific functions for the core
const openaiAgentFns: AgentSpecificFunctions = {
  buildRequestBody: buildOpenAIRequestBody,
  postToLLM: postToOpenAI,
  llmProviderName: 'OpenAI',
};

// Create the Express app and start server function using the core utility
const { app, startServer } = createAgentApp(port, dbStore, openaiAgentFns);

startServer();
```

---

#### 9. Updated File: `./code-ai-agent/anthropic-agent/src/main.ts`

```typescript
import { createAgentApp, AgentSpecificFunctions } from '@code-ai-agent/agent-core';
import { createSQLiteStore, SQLiteStore } from '@code-ai-agent/lib';
import axios from 'axios';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 6000;

// Initialize agent-specific DB store directly
const dbStore = createSQLiteStore('/tmp/anthropic_agent.db');

// --- API Interaction ---
async function buildAnthropicRequestBody(db: SQLiteStore): Promise<any> {
  // Fetch system instructions here and include in the request body
  const systemInstructions = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['system_instructions']))?.value || '';
  const prompt = (await db.get<{ value: string }>('SELECT value FROM config WHERE key = ?', ['prompt']))?.value || '';
  const dataEntries = await db.all<{ file_path: string, file_content: string }>('SELECT file_path, file_content FROM data ORDER BY id ASC');

  const messages: Array<{ role: string, content: string }> = [];

  let contextMessage = 'I need your help on this project.';

  for (const entry of dataEntries) {
    contextMessage += `\n\nThe content of the ${entry.file_path} file is:\n${entry.file_content}`;
  }

  messages.push({ role: 'user', content: contextMessage });

  if (prompt) {
    messages.push({ role: 'user', content: prompt });
  }

  return {
    model: '', // Will be set in postToAnthropic
    max_tokens: 32000,
    system: systemInstructions || undefined, // Anthropic system instructions are separate
    messages
  };
}

// postToAnthropic now doesn't need an 'instructions' parameter, as system is handled in buildAnthropicRequestBody
function postToAnthropic(requestBody: any, apiKey: string, model: string): Promise<any> {
  const url = 'https://api.anthropic.com/v1/messages';
  requestBody.model = model;

  return axios.post(url, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  });
}

const anthropicAgentFns: AgentSpecificFunctions = {
  buildRequestBody: buildAnthropicRequestBody,
  postToLLM: postToAnthropic,
  llmProviderName: 'Anthropic',
};

const { app, startServer } = createAgentApp(port, dbStore, anthropicAgentFns);

startServer();
```

---

#### 10. Removed Files:

The following files are no longer needed and should be deleted:

*   `./code-ai-agent/openai-agent/src/db.ts`
*   `./code-ai-agent/anthropic-agent/src/db.ts`
*   `./code-ai-agent/googleai-agent/src/db.ts` (assuming it exists and follows the same pattern)

---

### Explanation of Changes:

*   **`agent-core` Library:** A new library `agent-core` is introduced. It contains `createAgentApp`, which is a factory function for setting up an Express server. This function takes the `port`, a `SQLiteStore` instance, and an `AgentSpecificFunctions` object.
*   **`AgentSpecificFunctions` Interface:** This interface defines the contract for agent-specific logic: `buildRequestBody` (how to construct the LLM API request payload), `postToLLM` (how to make the actual API call), and `llmProviderName` (for logging and error messages).
*   **Centralized `handleConfig`, `handleFile`, `handlePrompt`:** These common route handlers are now part of `createAgentApp` in `agent-core.ts`. They use the injected `dbStore` and the agent-specific `buildRequestBody` and `postToLLM` functions.
*   **Simplified `main.ts` for Agents:** Each agent's `main.ts` file is drastically reduced. It now primarily focuses on:
    *   Defining its specific port.
    *   Creating its unique `SQLiteStore` instance (e.g., `createSQLiteStore('/tmp/openai_agent.db')`).
    *   Implementing its `buildRequestBody` and `postToLLM` functions according to the `AgentSpecificFunctions` interface.
    *   Calling `createAgentApp` with these specifics.
*   **`buildRequestBody` now handles `system_instructions`:** To simplify the `postToLLM` interface, each agent's `buildRequestBody` is now responsible for fetching `system_instructions` from the database and including them in the LLM request body in the format required by that specific LLM (e.g., `instructions` for OpenAI, `system` for Anthropic).
*   **Removed Redundant `db.ts` files:** The agent-specific `src/db.ts` files were merely re-exporting functions from `@code-ai-agent/lib`. Now, `createSQLiteStore` is used directly in `main.ts`, making these files obsolete.
*   **`tsconfig.base.json` Update:** The `paths` in your base TypeScript configuration are updated to recognize the new `@code-ai-agent/agent-core` library.

This factorization significantly reduces code duplication, improves modularity, and makes it easier to add new LLM agents in the future by simply implementing the `AgentSpecificFunctions` interface.

GoogleAI gemini-2.5-flash (9k in, 4k out)



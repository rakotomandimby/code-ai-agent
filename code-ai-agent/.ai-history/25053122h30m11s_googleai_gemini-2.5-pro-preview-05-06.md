# Display the API keys in the logs and refuse to start the server if they are not set 

This application will consume APIs.
That need API keys be at least set.

If API keys are not set, I want the server to refuse to start and display the API keys in the console logs.

Tell me the modifications to make to the code below to achieve that.




# This is gemini-2.5-pro-preview-05-06 answer (15k in, 1k out)

Okay, I can help you with that. We'll modify the `main.ts` file for each of your agent applications (`openai-agent`, `googleai-agent`, and `anthropic-agent`) to check for the presence of their respective API keys. If a key is not set, the server will log an error message, display the current (undefined or empty) value of the key, and then exit, preventing the server from starting.

Here are the modifications:

### 1. Modify `openai-agent/src/main.ts`

We'll add a check for `OPENAI_API_KEY`.

```typescript
import express from 'express';
import dotenv from 'dotenv';
import router from './routes';

// Initialize dotenv
dotenv.config();

// --- Start of changes ---
// Check for OpenAI API Key
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.error('ERROR: OPENAI_API_KEY is not set in the environment variables.');
  console.error('Current value of OPENAI_API_KEY:', openaiApiKey);
  console.error('OpenAI agent server will not start without the API key.');
  process.exit(1); // Exit the process with an error code
} else {
  console.log('[server]: OPENAI_API_KEY is set:', openaiApiKey); // Log the API key
}
// --- End of changes ---

// Create a new express application instance
const app: express.Application = express();
const port: string | number = process.env.PORT || 4000;

// Middleware to parse JSON bodies
app.use(express.json());

// Use the router
app.use(router);

// Start the server
app.listen(port, () => {
  console.log(`[server]: OpenAI agent is running at http://0.0.0.0:${port}`);
});

```

### 2. Modify `googleai-agent/src/main.ts`

We'll add a check for `GOOGLEAI_API_KEY`.

```typescript
import express from 'express';
import dotenv from 'dotenv';
import router from './routes';

// Initialize dotenv
dotenv.config();

// --- Start of changes ---
// Check for GoogleAI API Key
const googleaiApiKey = process.env.GOOGLEAI_API_KEY;

if (!googleaiApiKey) {
  console.error('ERROR: GOOGLEAI_API_KEY is not set in the environment variables.');
  console.error('Current value of GOOGLEAI_API_KEY:', googleaiApiKey);
  console.error('GoogleAI agent server will not start without the API key.');
  process.exit(1); // Exit the process with an error code
} else {
  console.log('[server]: GOOGLEAI_API_KEY is set:', googleaiApiKey); // Log the API key
}
// --- End of changes ---

// Create a new express application instance
const app: express.Application = express();
const port: string | number = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Use the router
app.use(router);

// Start the server
app.listen(port, () => {
  console.log(`[server]: GoogleAI agent is running at http://0.0.0.0:${port}`);
});

```

### 3. Modify `anthropic-agent/src/main.ts`

We'll add a check for `ANTHROPIC_API_KEY`.

```typescript
import express from 'express';
import dotenv from 'dotenv';
import router from './routes';

// Initialize dotenv
dotenv.config();

// --- Start of changes ---
// Check for Anthropic API Key
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set in the environment variables.');
  console.error('Current value of ANTHROPIC_API_KEY:', anthropicApiKey);
  console.error('Anthropic agent server will not start without the API key.');
  process.exit(1); // Exit the process with an error code
} else {
  console.log('[server]: ANTHROPIC_API_KEY is set:', anthropicApiKey); // Log the API key
}
// --- End of changes ---

// Create a new express application instance
const app: express.Application = express();
const port: string | number = process.env.PORT || 6000;

// Middleware to parse JSON bodies
app.use(express.json());

// Use the router
app.use(router);

// Start the server
app.listen(port, () => {
  console.log(`[server]: Anthropic agent is running at http://0.0.0.0:${port}`);
});

```

**Explanation of Changes:**

*   **`dotenv.config()`**: This line remains at the top to ensure that environment variables from a `.env` file (if you are using one) are loaded before we check them.
*   **API Key Check**:
    *   We retrieve the respective API key from `process.env`.
    *   We check if the key is falsy (i.e., `undefined`, `null`, or an empty string).
*   **Logging and Exit**:
    *   If the key is not set, an error message is printed to the console, including the current (missing) value of the key.
    *   `process.exit(1)` is called to terminate the Node.js process with an error code, preventing the server from starting.
    *   If the key *is* set, its value is logged to the console. This fulfills your requirement to display the API keys. **Please be mindful of security implications when logging API keys, especially in production environments.** For development and debugging, this can be useful.

With these changes, each agent server will first validate the presence of its required API key. If the key is missing, it will provide a clear error message and shut down. If the key is present, it will be logged, and the server will proceed with its startup sequence.

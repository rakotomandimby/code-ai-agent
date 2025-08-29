# Write de technical description of the application.

I want to produce a technical description of the application that I will give to LLM.
The LLM will then help me to implement new features and resolve bugs.
But providing a technical description will help the LLM to better understand the application, 
thus improving the quality of the responses.

Provide me that technical description of the application.


# GGL Technical Description of the Code AI Agent Application

This document provides a detailed technical overview of the Code AI Agent monorepo application. The application is a Node.js-based system built with TypeScript and managed by the Nx build system. It is designed to act as a unified interface to multiple AI provider APIs.

### 1. High-Level Architecture

The project is structured as an Nx monorepo containing one shared library (`lib`) and three separate agent applications:
*   `openai-agent`
*   `googleai-agent`
*   `anthropic-agent`

Each agent is an independent Express.js server that exposes an API endpoint for interacting with a specific AI provider (OpenAI, Google AI, or Anthropic). They all rely on the shared `lib` for common functionality, promoting code reuse and consistency.

The core design pattern is a set of microservices (the agents) that receive and aggregate prompt data over several HTTP requests before making a single call to the external AI provider.

### 2. Shared Library (`lib`)

The `lib` project contains the core logic and abstractions shared across all agents.

**Key Components:**

*   **`BaseRepository` (`lib/src/base-repository.ts`)**:
    *   An abstract class for data persistence using `sqlite3`.
    *   Each agent gets its own temporary database file (e.g., `/tmp/openai.sqlite`).
    *   It manages tables for `messages`, `system_instruction`, `model_to_use`, `temperature`, and `top_p`.
    *   Provides methods to `init` the database, `save` data chunks, `clear` all data, and retrieve settings and the full conversation history (`getMultiTurnChat`).

*   **`AIHttpClient` (`lib/src/ai-http-client.ts`)**:
    *   A generic HTTP client built on `axios` to communicate with AI provider APIs.
    *   It is initialized with a `provider` string ('openai', 'googleai', 'anthropic').
    *   The `initClient()` method configures provider-specific details like the API URL, authentication headers (`Authorization`, `x-api-key`), and API version headers (for Anthropic). API keys are read from environment variables (e.g., `OPENAI_API_KEY`).
    *   The `post()` method sends the request and includes robust, provider-specific error handling. It can also return a mock response if the model is set to `'disabled'`.

*   **`createAgentRouter` (`lib/src/agent-router.ts`)**:
    *   A factory function that creates and configures an Express.js router for a specific agent.
    *   It sets up two main endpoints:
        1.  `GET /<agentName>/clear`: Clears the agent's database.
        2.  `POST /<agentName>`: The primary endpoint for interaction.
    *   This router implements the core request aggregation logic.

*   **`Chunk` (`lib/src/chunk.ts`)**: A simple data transfer object used to encapsulate data (`kind`, `id`, `role`, `content`) before it's saved to the database by the `BaseRepository`. It also handles escaping single quotes for SQL queries.

*   **`MultiTurnChat` (`lib/src/multi-turn-chat.ts`)**: A class that holds the conversation history (a collection of message rows from the database).

*   **Error/Disabled Responses (`lib/src/get-*-response.ts`)**: A set of helper functions (`getOpenAIErrorResponse`, `getGoogleAIErrorResponse`, `getAnthropicErrorResponse`, `getDisabledModelResponse`) that generate standardized JSON responses for errors or disabled models, formatted to match the native structure of each AI provider's API.

### 3. Agent Applications

All three agent applications (`openai-agent`, `googleai-agent`, `anthropic-agent`) follow the same structure.

**Common Structure:**

*   **`main.ts`**: The application entry point. It initializes `dotenv` to load environment variables, creates an Express app, applies the `express.json()` middleware, and starts the server on a dedicated port (OpenAI: 4000, GoogleAI: 5000, Anthropic: 6000).
*   **`routes.ts`**: Imports `createAgentRouter` from the `lib` and uses it to instantiate the agent's router. It provides the agent-specific components:
    *   A new instance of the agent's `Repository` (e.g., `new OpenAIRepository()`).
    *   The agent's name (e.g., `'openai'`).
    *   The agent's `AIHttpClient` class (e.g., `OpenAIAIHttpClient`).
    *   The agent's `Body` constructor (e.g., `OpenAIBody`).
*   **`ai-http-client.ts`**: A thin wrapper class that extends `AIHttpClient` from the `lib` and calls the `super()` constructor with its specific provider name.
*   **`repository/<agent>-repository.ts`**: A thin wrapper class that extends `BaseRepository` from the `lib` and calls the `super()` constructor with its specific database name.
*   **`model/<agent>-body.ts`**: This is the most critical provider-specific component. This class is responsible for constructing the final JSON request body that will be sent to the AI provider's API. It receives the system instruction, chat history, model, temperature, and topP, and formats them into the precise structure required by that provider's API (e.g., OpenAI's `messages` array vs. GoogleAI's `contents` and `system_instruction` objects).

### 4. Request Flow and Logic

The application uses a stateful, multi-request approach to build a single AI prompt.

1.  **Data Submission**: A client sends a series of `POST /<agentName>` requests. Each request contains a piece of the final prompt, such as the system instruction, a user message, or a model setting.
    ```json
    // First request
    { "system_instruction": "You are a helpful assistant." }

    // Second request
    { "model_to_use": "gpt-4o" }

    // Third request
    { "role": "user", "content": "Hello, world!" }
    ```
2.  **Data Aggregation**: The `agent-router` receives each request. If the request body is not empty, it saves the data as a `Chunk` into the agent's SQLite database via its `repository`. It then returns an empty `200 OK` response.
3.  **Execution Trigger**: The client sends a final, **empty** `POST /<agentName>` request with a body of `{}`.
4.  **Prompt Assembly**: This empty request triggers the main logic inside `agent-router`:
    a. It retrieves all the previously saved data (system instruction, messages, settings) from the database using the `repository`.
    b. It instantiates the agent's specific `Body` class (e.g., `OpenAIBody`).
    c. It calls the setter methods on the `Body` instance to populate it with the retrieved data. The `Body` class internally transforms this data into the provider-specific JSON format.
5.  **API Call**:
    a. The router instantiates the agent's `AIHttpClient`.
    b. It calls the `post()` method on the client, passing the JSON body generated by the `Body` class.
    c. The `AIHttpClient` sends the formatted request to the external AI provider's API.
6.  **Response and Cleanup**:
    a. The `AIHttpClient` receives the response from the AI provider.
    b. The `agent-router` forwards this response directly to the client.
    c. Crucially, the router then calls `repository.clear()` to wipe all data from the SQLite database, ensuring the next sequence of requests starts fresh.

### 5. Technology Stack and Tooling

*   **Core Framework**: Node.js, Express.js
*   **Language**: TypeScript
*   **Build System**: Nx (with esbuild)
*   **HTTP Client**: Axios
*   **Database**: `sqlite3` for temporary, request-scoped data storage.
*   **Environment Management**: `dotenv`
*   **Testing**: Jest
*   **Execution**: The project includes a shell script (`code-ai-agent-monorepo`) that demonstrates how to install dependencies, build all projects, and run the three agent servers concurrently.

GoogleAI gemini-2.5-pro (15k in, 1k out)



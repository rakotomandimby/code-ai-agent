# CodeAiAgent Project Description

|           |                               :warning:                                                                         |           |
| :---: | :---: | :---: |
| :warning: | This software has been designed to be an agent of [code-ai.nvim](https://github.com/rakotomandimby/code-ai.nvim) | :warning: |



This project is a monorepo built using NX, designed to facilitate interaction with various AI models, 
including Anthropic / Claude, OpenAI / ChatGPT and GoogleAI / Gemini. 
The architecture is modular, allowing for easy scalability and maintainability, 
with shared libraries and utilities that streamline the development process. 

The project leverages TypeScript for type safety and clarity, 
and it incorporates various tools such as Jest for testing, 
ESLint for code quality, and SQLite for data storage, 
ensuring a robust and efficient development environment.

## OpenAI ChatGPT Agent

The ChatGPT agent, located in the [./openai-agent/](./code-ai-agent/openai-agent/) directory, is designed to interact with OpenAI's ChatGPT model.
It utilizes an Express server to handle HTTP requests and responses, allowing users to send messages and receive AI-generated responses. 
The agent is built around a repository pattern that manages the storage and retrieval of conversation data, ensuring that interactions are contextually aware. 
The implementation includes a dedicated HTTP client that abstracts the complexities of API communication, making it easier to integrate and extend the functionality of the ChatGPT agent.

**Special Note:** The OpenAI agent targets the [Responses API of OpenAI, which is different from the Chat Completions API](https://platform.openai.com/docs/guides/migrate-to-responses). That is because the [ChatGPT 5 Codex model is only available through the Responses API](https://platform.openai.com/docs/models/gpt-5-codex).

## GoogleAI Gemini Agent

The Gemini agent, found in the [./googleai-agent/](./code-ai-agent/googleai-agent/) directory, serves a similar purpose but is tailored to interact with Google's Gemini model. 
Like the ChatGPT agent, it is built on an Express framework and follows a modular architecture that promotes code reuse and separation of concerns. 
The Gemini agent also employs a repository pattern for managing conversation history and settings, ensuring that user interactions are preserved across sessions. 
The agent's HTTP client is specifically configured to communicate with the Gemini API, providing a seamless experience for users looking to leverage the capabilities of this advanced AI model.

## Anthropic Claude Agent

The Anthropic agent, located in the [./anthropic-agent/](./code-ai-agent/anthropic-agent/) directory, is designed to interface with Anthropic's Claude model.
It shares a similar architecture with the other agents, utilizing an Express server to manage HTTP requests and responses. 
The agent is structured around a repository pattern that handles the storage and retrieval of conversation data, ensuring that interactions are contextually relevant. 
The implementation includes a specialized HTTP client that abstracts the

## GitHub Models Agent

The GitHub Models agent, located in the [./github-agent/](./code-ai-agent/github-agent/) directory, is tailored to interact with GitHub Models' chat completions API.
It reuses the shared Express-based architecture and database utilities to manage conversation context, building prompts from stored project files and relaying them to GitHub's inference endpoint through a dedicated HTTP client.

# Installation

Requirements:
- Have Node.js installed on your machine.

Check [./code-ai-agent/code-ai-agent-monorepo](./code-ai-agent/code-ai-agent-monorepo) for exemple for a launch script.

But manually, you can do the following:

```bash
npx nx reset \
&& npx nx build lib \
&& npx nx build googleai-agent \
&& npx nx build anthropic-agent \
&& npx nx build openai-agent \
&& npx nx build github-agent
```

```bash
npx nx serve googleai-agent
npx nx serve anthropic-agent
npx nx serve openai-agent \
npx nx serve github-agent
```

Or, leverage Nx parallelism to build and serve all projects:

```bash
npx nx reset
npx nx run-many --target=build --projects=lib,googleai-agent,anthropic-agent,openai-agent,github-agent
npx nx run-many --target=serve --projects=googleai-agent,anthropic-agent,openai-agent,github-agent
```
# How did I create the workspaces

(This sections is for archives only)

```bash
npx create-nx-workspace@latest code-ai-agent --preset=apps
cd code-ai-agent/
npm install nx@latest --save-dev
npm install @nx/node --save-dev
```

```bash
npx nx generate @nx/node:library lib
npx nx generate @nx/node:application googleai-agent
npx nx generate @nx/node:application anthropic-agent
npx nx generate @nx/node:application openai-agent
npx nx generate @nx/node:application github-agent
```

```bash
cd code-ai-agent/
npm install nx@latest --save-dev
npm install @nx/node --save-dev
```

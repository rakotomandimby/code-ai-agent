# Code-AI.nvim agent

This software is meant to be a companion to the [Code-AI.nvim](https://github.com/rakotomandimby/code-ai.nvim) plugin. 
It is a standalone agent that can be used to query LLMs REST APIs for code suggestions.
We do not use SDKs here: we directly query the REST APIs.

# Installation

There are two LLMs supported by this agent:
- ChatGPT
- Gemini

This repository hosts the code for the two agents.

To run the [ChatGPT](./code-chatgpt/) agent:

```bash
cd code-chatgpt
npm install 
npm run build
npn run start
```

The agent will listen on port `4000`.

To run the [Gemini](./code-gemini/) agent:

```bash
cd code-gemini
npm install
npm run build
npm run start
```

The agent will listen on port `5000`.

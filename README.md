# CodeAiAgent

## Installation

How did I create the workspaces:

```bash
npx create-nx-workspace@latest code-ai-agent --preset=apps
cd code-ai-agent/
npm install nx@latest --save-dev
npm install @nx/node --save-dev
```

```bash
npx nx generate @nx/node:application gemini-agent 
npx nx generate @nx/node:application chatgpt-agent 
npx nx generate @nx/node:library lib
```

```bash
npx nx build chatgpt-agent
npx nx build gemini-agent
npx nx build lib
```

```bash
npx nx reset
npx nx build lib
npx nx build gemini-agent
npx nx build chatgpt-agent

```bash
npx nx serve chatgpt-agent
npx nx serve gemini-agent
```


```bash
npx nx reset
npx nx run-many --target=build --projects=chatgpt-agent,gemini-agent,lib
npx nx run-many --target=serve --projects=chatgpt-agent,gemini-agent
```



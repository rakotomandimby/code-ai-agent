# LLM API Integration Documentation

This document describes, at wire-format level, how the project uses the LLM APIs in:

- `code-ai-agent/googleai-agent/src/main.ts`
- `code-ai-agent/openai-agent/src/main.ts`

It is based on the implementation, not on an abstract design. The focus is:

1. How request payloads are built.
2. Which HTTP endpoints and headers are used.
3. What response shape is returned downstream.
4. Which fallback error payloads are synthesized when the upstream call fails.

---

## 1. Shared architecture

Both agents follow the same high-level flow:

1. The HTTP layer stores incoming configuration and prompt data in SQLite.
2. The agent reads the current prompt and all stored project files from SQLite.
3. The agent reconstructs a synthetic conversation from that stored state.
4. The agent sends one JSON request with `axios.post(...)` to the provider API.
5. On success, the raw provider response body (`response.data`) is returned as-is.
6. On failure, the agent returns a provider-shaped synthetic error payload.

### 1.1 SQLite data sources

Both agents use the same database schema from `@code-ai-agent/lib`.

```sql
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  file_content TEXT NOT NULL
);
```

### 1.2 Configuration keys used by both agents

| `config.key` | Meaning | Used in upstream API call |
| --- | --- | --- |
| `api_key` | Provider API credential | HTTP auth header |
| `model` | Model identifier | Top-level `model` request field |
| `system_instructions` | System prompt / instruction block | `instructions` for OpenAI, `system_instruction` for Google AI |
| `prompt` | Latest user request | Appended to the synthetic conversation |

### 1.3 File context loading

Both agents load project files with:

```sql
SELECT file_path, file_content FROM data ORDER BY id ASC
```

That means file context is replayed in insertion order.

### 1.4 Synthetic conversation algorithm

Both agents construct a synthetic back-and-forth conversation instead of sending the stored files as a single blob.

The sequence is:

1. Always start with a user message: `"I need your help on this project."`
2. For each stored file:
   1. Add an assistant/model turn asking for that file.
   2. Add a user turn containing the file content wrapped in triple backticks.
3. If there are no files and no prompt:
   1. Add an assistant/model turn asking how to proceed.
4. If a prompt exists:
   1. Add an assistant/model turn asking what to do next.
   2. Add a user turn containing the prompt text.
5. If the last turn is not a user turn, append:
   1. `"Please let me know how you would like to proceed."`

This guarantees that the final turn sent upstream is always a user turn.

### 1.5 Example reconstructed logical conversation

Given:

- `prompt = "Refactor the parser and explain the changes."`
- two stored files: `src/parser.ts`, `src/tokenizer.ts`

The reconstructed conversation is logically:

~~~text
user: I need your help on this project.
assistant: Please provide the content of the `src/parser.ts` file.
user: Here is the content of the `src/parser.ts` file:
```ts
...file content...
```

assistant: Please provide the content of the `src/tokenizer.ts` file.
user: Here is the content of the `src/tokenizer.ts` file:
```ts
...file content...
```

assistant: What would you like to do next?
user: Refactor the parser and explain the changes.
~~~

The exact JSON encoding of that conversation differs between OpenAI and Google AI.

---

## 2. OpenAI agent

Source: `code-ai-agent/openai-agent/src/main.ts`

### 2.1 Endpoint and transport

- **HTTP method:** `POST`
- **URL:** `https://api.openai.com/v1/responses`
- **Client:** `axios`
- **Headers:**

```http
Content-Type: application/json
Authorization: Bearer <api_key>
```

### 2.2 Request construction

`buildRequestBody()` builds the base payload, then `postToOpenAI(...)` injects:

- `model`
- optional `instructions`

### 2.2.1 Exact request shape produced by the code

```ts
type OpenAIConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type OpenAIRequest = {
  input: OpenAIConversationMessage[];
  max_output_tokens: number; // always 98304
  model: string;
  instructions?: string; // only if trimmed string is non-empty
};
```

### 2.2.2 Important implementation details

- `max_output_tokens` is always `1024 * 96 = 98304`.
- No `temperature` is sent.
- No `tools` are sent.
- No streaming is used.
- The code uses plain string `content`, not typed multimodal content items.
- `instructions` is omitted if `system_instructions.trim()` is empty.

### 2.2.3 Example request body

Representative payload produced by the current code:

```json
{
  "input": [
    {
      "role": "user",
      "content": "I need your help on this project."
    },
    {
      "role": "assistant",
      "content": "Please provide the content of the `src/parser.ts` file."
    },
    {
      "role": "user",
      "content": "Here is the content of the `src/parser.ts` file:\n```\nexport function parse(input: string) {\n  return input.trim();\n}\n```\n"
    },
    {
      "role": "assistant",
      "content": "Please provide the content of the `src/tokenizer.ts` file."
    },
    {
      "role": "user",
      "content": "Here is the content of the `src/tokenizer.ts` file:\n```\nexport function tokenize(input: string) {\n  return input.split(/\\s+/);\n}\n```\n"
    },
    {
      "role": "assistant",
      "content": "What would you like to do next?"
    },
    {
      "role": "user",
      "content": "Refactor the parser and explain the changes."
    }
  ],
  "max_output_tokens": 98304,
  "model": "gpt-5-codex",
  "instructions": "You are a precise TypeScript refactoring assistant. Prefer minimal diffs."
}
```

### 2.3 Semantics of OpenAI fields

| Field | Value source | Notes |
| --- | --- | --- |
| `model` | `config.model` | Required; request is not sent if missing |
| `instructions` | `config.system_instructions` | Trimmed before use; omitted if empty |
| `input` | Reconstructed from `config.prompt` + `data` rows | Ordered sequence of text-only turns |
| `max_output_tokens` | hard-coded | Always `98304` |

### 2.4 Response handling

On success, the agent does **no response normalization**:

```ts
const apiResponse = await postToOpenAI(...);
return apiResponse.data;
```

So the HTTP response returned by this agent is the raw JSON body from `POST /v1/responses`.

### 2.4.1 Representative success response shape

The code does not constrain the upstream body, but the downstream consumer should expect an OpenAI Responses-style payload with at least:

```json
{
  "id": "resp_123",
  "object": "response",
  "model": "gpt-5-codex",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "I refactored the parser by extracting token normalization into a helper and simplifying the parse loop.",
          "annotations": []
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 1842,
    "output_tokens": 317,
    "total_tokens": 2159
  }
}
```

### 2.4.2 Output extraction pattern

The most relevant assistant text is typically found under:

```text
output[0].content[0].text
```

More generally:

```text
output[*].content[*]
```

where content items may be typed objects such as `output_text`.

### 2.5 Synthetic error response format

If the upstream call fails, the OpenAI agent returns a synthetic object shaped like an OpenAI Responses payload:

```json
{
  "model": "gpt-5-codex",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "API Error (401): {\"error\":{\"message\":\"Invalid API key\"}}",
          "annotations": []
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0
  }
}
```

### 2.5.1 Error text generation rules

The error string is built as follows:

- Axios response error:
  - `API Error (<status>): <JSON-stringified response body>`
- Axios request with no response:
  - `Network error: No response received from the API.`
- Axios setup error:
  - `Request error: <message>`
- Generic JS error:
  - `Error: <message>`
- Otherwise:
  - `An unknown error occurred while processing your request.`

---

## 3. Google AI agent

Source: `code-ai-agent/googleai-agent/src/main.ts`

### 3.1 Endpoint and transport

- **HTTP method:** `POST`
- **URL:** `https://generativelanguage.googleapis.com/v1beta/interactions`
- **Client:** `axios`
- **Headers:**

```http
Content-Type: application/json
x-goog-api-key: <api_key>
Api-Revision: 2026-05-20
```

The `Api-Revision: 2026-05-20` header is important because the code is built against the newer `steps` schema.

### 3.2 Request construction

`buildRequestBody(instructions, model)` creates the full payload before transmission.

### 3.2.1 Exact request shape produced by the code

```ts
type GoogleAIStep = {
  type: 'user_input' | 'model_output';
  content: Array<{
    type: 'text';
    text: string;
  }>;
};

type GoogleAIRequest = {
  model: string;
  input: GoogleAIStep[];
  generation_config: {
    temperature: number; // always 0.7
    top_p: number;       // always 0.9
    thinking_level?: 'high'; // only for gemini-3.5-flash
  };
  system_instruction?: string; // only if trimmed string is non-empty
};
```

### 3.2.2 Important implementation details

- `generation_config.temperature` is always `0.7`.
- `generation_config.top_p` is always `0.9`.
- If `model === "gemini-3.5-flash"`, then:

```json
{
  "generation_config": {
    "thinking_level": "high"
  }
}
```

is added in addition to `temperature` and `top_p`.

- No tools are sent.
- No streaming is used.
- All content items are text-only:
  - `content: [{ "type": "text", "text": "..." }]`
- `system_instruction` is omitted if `instructions.trim()` is empty.

### 3.2.3 Example request body

Representative payload produced by the current code:

```json
{
  "model": "gemini-3.5-flash",
  "input": [
    {
      "type": "user_input",
      "content": [
        {
          "type": "text",
          "text": "I need your help on this project."
        }
      ]
    },
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "Please provide the content of the `src/parser.ts` file."
        }
      ]
    },
    {
      "type": "user_input",
      "content": [
        {
          "type": "text",
          "text": "Here is the content of the `src/parser.ts` file:\n```\nexport function parse(input: string) {\n  return input.trim();\n}\n```\n"
        }
      ]
    },
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "What would you like to do next?"
        }
      ]
    },
    {
      "type": "user_input",
      "content": [
        {
          "type": "text",
          "text": "Refactor the parser and explain the changes."
        }
      ]
    }
  ],
  "generation_config": {
    "temperature": 0.7,
    "top_p": 0.9,
    "thinking_level": "high"
  },
  "system_instruction": "You are a precise TypeScript refactoring assistant. Prefer minimal diffs."
}
```

### 3.3 Semantics of Google AI fields

| Field | Value source | Notes |
| --- | --- | --- |
| `model` | `config.model` | Required; request is not sent if missing |
| `system_instruction` | `config.system_instructions` | Trimmed before use; omitted if empty |
| `input` | Reconstructed from `config.prompt` + `data` rows | Ordered steps timeline |
| `generation_config.temperature` | hard-coded | Always `0.7` |
| `generation_config.top_p` | hard-coded | Always `0.9` |
| `generation_config.thinking_level` | derived from model name | Present only for `gemini-3.5-flash` |

### 3.4 Response handling

On success, the agent does **no response normalization**:

```ts
const apiResponse = await postToGoogleAI(...);
return apiResponse.data;
```

So the HTTP response returned by this agent is the raw JSON body from `POST /v1beta/interactions`.

### 3.4.1 Representative success response shape

Because the request opts into the post-`2026-05-20` schema, the important response container is `steps`, not legacy `outputs`.

Representative downstream payload:

```json
{
  "id": "int_123",
  "status": "completed",
  "steps": [
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "I refactored the parser by extracting token normalization into a helper and simplifying the parse loop."
        }
      ]
    }
  ],
  "usage": {
    "total_tokens": 2159
  }
}
```

### 3.4.2 Output extraction pattern

The most relevant assistant text is typically found under:

```text
steps[0].content[0].text
```

More generally:

```text
steps[*]
```

where each step has a discriminating `type`, and model text is carried by:

```text
step.type === "model_output"
step.content[*].type === "text"
```

### 3.5 Synthetic error response format

If the upstream call fails, the Google AI agent returns a synthetic object shaped around the same `steps` concept:

```json
{
  "steps": [
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "API Error (403): {\"error\":{\"message\":\"permission denied\"}}"
        }
      ]
    }
  ],
  "usage": {
    "total_tokens": 0
  }
}
```

### 3.5.1 Error text generation rules

The error string is built identically to the OpenAI agent:

- Axios response error:
  - `API Error (<status>): <JSON-stringified response body>`
- Axios request with no response:
  - `Network error: No response received from the API.`
- Axios setup error:
  - `Request error: <message>`
- Generic JS error:
  - `Error: <message>`
- Otherwise:
  - `An unknown error occurred while processing your request.`

---

## 4. Side-by-side wire-format comparison

| Aspect | OpenAI agent | Google AI agent |
| --- | --- | --- |
| Endpoint | `POST https://api.openai.com/v1/responses` | `POST https://generativelanguage.googleapis.com/v1beta/interactions` |
| Auth header | `Authorization: Bearer <api_key>` | `x-goog-api-key: <api_key>` |
| Schema revision header | none | `Api-Revision: 2026-05-20` |
| System prompt field | `instructions` | `system_instruction` |
| Conversation field | `input` | `input` |
| Conversation item type | `{ role, content: string }` | `{ type, content: [{ type: "text", text }] }` |
| Synthetic assistant turns | `role: "assistant"` | `type: "model_output"` |
| Synthetic user turns | `role: "user"` | `type: "user_input"` |
| Sampling config | none sent | `generation_config.temperature = 0.7`, `top_p = 0.9` |
| Extra model-specific config | none | `thinking_level = "high"` for `gemini-3.5-flash` |
| Max output cap | `max_output_tokens = 98304` | not set by this code |
| Success response handling | raw `response.data` passthrough | raw `response.data` passthrough |
| Error response shape | OpenAI-style `output[]` | Google-style `steps[]` |

---

## 5. Behavioral conclusions from the code

1. These agents are **stateless at provider level but stateful locally**: context is reconstructed from SQLite on every prompt.
2. The project does **not** send uploaded files as native provider file objects; it inlines file contents into text prompts.
3. The project does **not** use tool calling, streaming, or structured output in these two agents.
4. The project returns **raw upstream success payloads**, so downstream consumers must understand provider-native schemas.
5. The project emits **synthetic fallback payloads** that mimic the provider response family closely enough for downstream consumers to treat errors as model text.

---

## 6. Minimal implementation references

- OpenAI request builder:
  - `code-ai-agent/openai-agent/src/main.ts`
  - `buildRequestBody()`
  - `postToOpenAI()`
  - `createErrorResponse()`

- Google AI request builder:
  - `code-ai-agent/googleai-agent/src/main.ts`
  - `buildRequestBody(instructions, model)`
  - `postToGoogleAI()`
  - `createErrorResponse()`

- Shared HTTP/database orchestration:
  - `code-ai-agent/lib/src/lib/express-handlers.ts`
  - `code-ai-agent/lib/src/lib/db.ts`

# Handle Anthropic Error

When the Anthropic API answers with other than an HTTP 200 status code, the response has this structure:

```json
{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}
```

I want to gracefully handle specific API errors from Anthropic by catching them in the `AIHttpClient`, 
extracting the error message, and formatting it into a standard Anthropic response structure before returning it, 
I prefer that instead of letting the raw error propagate.

Tell me the modifications to make to the code in order to achieve that.
In the same way I managed `getGeminiErrorResponse`, prefer to use a separate file in order to get reasonable lines of code in the `AIHttpClient` class.




# This is claude-3-7-sonnet-latest answer (17k in, 2k out)

# Implementing Anthropic Error Handling

To gracefully handle Anthropic API errors, you'll need to create a dedicated error response handler and update the `AIHttpClient` class to use it. I'll create the implementation similar to how the Gemini and ChatGPT error handlers work.

## Step 1: Create the Anthropic Error Response Handler

First, let's create a new file called `get-anthropic-error-response.ts` in the `lib/src` directory:

```typescript
export default function getAnthropicErrorResponse(errorMessage: string): object {
  return {
    id: "error-response",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: `Anthropic API Error: ${errorMessage}`
      }
    ],
    model: "error",
    stop_reason: "error",
    usage: {
      input_tokens: 0,
      output_tokens: 0
    }
  };
}
```

## Step 2: Update the AIHttpClient to Handle Anthropic Errors

Now, let's modify the `ai-http-client.ts` file in the `lib/src` directory to import and use the new error handler:

```typescript
import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
import getGeminiErrorResponse from './get-gemini-error-response';
import getChatGPTErrorResponse from './get-chatgpt-error-response';
import getAnthropicErrorResponse from './get-anthropic-error-response'; // Add this line

export class AIHttpClient {
  protected provider: string;
  protected url: string;
  protected body: object;
  protected model: string | undefined;
  protected token: string;
  protected tokenHeaderName: string;
  protected tokenHeaderValue: string;
  protected apiVersionHeaderName: string;
  protected apiVersionHeaderValue: string;

  constructor(provider: string) {
    this.provider = provider;
    this.body = {};
    this.url = '';
    this.token = '';
    this.tokenHeaderName = '';
    this.tokenHeaderValue = '';
    this.apiVersionHeaderName = '';
    this.apiVersionHeaderValue = '';
    this.model = undefined;
  }

  setBody(body: object) {
    this.body = body;
  }
  setModel(model: string) {
    this.model = model;
  }

  async post(): Promise<Object> {
    if (this.model === 'disabled') {
      return getDisabledModelResponse(this.provider);
    }

    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      if (this.provider === 'anthropic') {
        axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
      }
      if (this.provider === 'gemini' && this.model) {
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      }

      const response = await axios.post(this.url, this.body);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>; // Use generic type for data initially

        // Handle ChatGPT specific errors
        if (
          this.provider === 'chatgpt' &&
          axiosError.response &&
          axiosError.response.data &&
          axiosError.response.data.error &&
          axiosError.response.data.error.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getChatGPTErrorResponse(errorMessage);
        }
        // Handle Gemini specific errors
        else if (
          this.provider === 'gemini' &&
          axiosError.response &&
          axiosError.response.data &&
          axiosError.response.data.error &&
          axiosError.response.data.error.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getGeminiErrorResponse(errorMessage);
        }
        // Handle Anthropic specific errors - add this block
        else if (
          this.provider === 'anthropic' &&
          axiosError.response &&
          axiosError.response.data &&
          axiosError.response.data.error &&
          axiosError.response.data.error.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getAnthropicErrorResponse(errorMessage);
        } else if (axiosError.response) {
          console.error(`<<<<< ${this.provider} HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`<<<<< ${this.provider} Response body: ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          console.error(`----- No response received from the ${this.provider} server`);
        } else {
          console.error(`----- Error setting up the request to ${this.provider}:`, axiosError.message);
        }
      } else {
        console.error(`!!!!! Non-Axios error occurred for ${this.provider}:`, error);
      }
      throw error;
    }
  }

  protected initClient() {
    if (this.provider === 'chatgpt') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.token = process.env.OPENAI_API_KEY ?? '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
    } else if (this.provider === 'gemini') {
      this.token = process.env.GEMINI_API_KEY ?? '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
      // The specific model URL is set in the post method for Gemini
    } else if (this.provider === 'anthropic') {
      this.url = 'https://api.anthropic.com/v1/messages';
      this.token = process.env.ANTHROPIC_API_KEY ?? '';
      this.tokenHeaderName = 'x-api-key';
      this.tokenHeaderValue = this.token;
      this.apiVersionHeaderName = 'anthropic-version';
      this.apiVersionHeaderValue = '2023-06-01';
    }
  }
}
```

## Step 3: Update the lib/src/index.ts to Export the New Function

To make the error response handler available to the rest of the application, update the index.ts file:

```typescript
export { Chunk } from './chunk';
export { MultiTurnChat } from './multi-turn-chat';
export { AIHttpClient } from './ai-http-client';
export { BaseRepository } from './base-repository';
export { createAgentRouter } from './agent-router';
// You might want to export the error response handlers if needed elsewhere
```

## Summary of Changes

1. Created a new file `get-anthropic-error-response.ts` in lib/src that formats Anthropic API errors into a standard response structure
2. Updated `ai-http-client.ts` to:
   - Import the new error response handler
   - Add specific error handling for Anthropic API errors
   - Return formatted error responses for Anthropic errors

These changes will ensure that when the Anthropic API returns an error, your application will gracefully handle it by returning a properly formatted response instead of throwing an exception or returning raw error data.


# Handle ChatGPT Error

When the ChatGPT API answers with other than an HTTP 200 status code, the response has this structure:

```json
{"error":
  {
    "message":"This model's maximum context length is 128000 tokens.",
    "type":"invalid_request_error",
    "param":"messages",
    "code":"context_length_exceeded"
  }
}
```

I want to gracefully handle specific API errors from ChatGPT by catching them in the `AIHttpClient`, 
extracting the error message, and formatting it into a standard ChatGPT response structure before returning it, 
I prefer that instead of letting the raw error propagate.

Tell me the modifications to make to the code in order to achieve that.
In the same way I managed `getGeminiErrorResponse`, prefer to use a separate file in order to get reasonable lines of code in the `AIHttpClient` class.




# This is claude-3-7-sonnet-latest answer (16k in, 2k out)

# Adding ChatGPT Error Handling

To gracefully handle ChatGPT API errors similar to how you've handled Gemini errors, we need to:

1. Create a new utility function in a separate file to format ChatGPT error responses
2. Modify the AIHttpClient class to catch and handle ChatGPT-specific errors

Let's implement these changes:

## 1. Create a new file for ChatGPT error response formatting

First, let's create a new file called `lib/src/get-chatgpt-error-response.ts`:

```typescript
export default function getChatGPTErrorResponse(errorMessage: string): object {
  return {
    id: "error-response",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "error",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `ChatGPT API Error: ${errorMessage}`
        },
        logprobs: null,
        finish_reason: "error"
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    },
    system_fingerprint: "error"
  };
}
```

## 2. Modify the AIHttpClient class to handle ChatGPT errors

Now, let's update the `lib/src/ai-http-client.ts` file to use this new function:

```typescript
import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
import getGeminiErrorResponse from './get-gemini-error-response';
import getChatGPTErrorResponse from './get-chatgpt-error-response'; // Add this line

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
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`); // Fixed the string interpolation
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
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`); // Fixed the string interpolation
          return getGeminiErrorResponse(errorMessage);
        } else if (axiosError.response) {
          console.error(`<<<<< ${this.provider} HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`); // Fixed the string interpolation
          console.error(`<<<<< ${this.provider} Response body: ${JSON.stringify(axiosError.response.data)}`); // Fixed the string interpolation
        } else if (axiosError.request) {
          console.error(`----- No response received from the ${this.provider} server`); // Fixed the string interpolation
        } else {
          console.error(`----- Error setting up the request to ${this.provider}:`, axiosError.message); // Fixed the string interpolation
        }
      } else {
        console.error(`!!!!! Non-Axios error occurred for ${this.provider}:`, error); // Fixed the string interpolation
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

## 3. Update the lib/src/index.ts file to export the error response functions:

```typescript
export { Chunk } from './chunk';
export { MultiTurnChat } from './multi-turn-chat';
export { AIHttpClient } from './ai-http-client';
export { BaseRepository } from './base-repository';
export { createAgentRouter } from './agent-router';
// Export the error response functions
export { default as getDisabledModelResponse } from './get-disabled-model-response';
export { default as getGeminiErrorResponse } from './get-gemini-error-response';
export { default as getChatGPTErrorResponse } from './get-chatgpt-error-response';
```

## Summary of changes:

1. Created a new `getChatGPTErrorResponse` function in a dedicated file that formats error messages into the standard ChatGPT response structure.
2. Updated the `AIHttpClient` class to handle ChatGPT errors by:
   - Importing the new error formatting function
   - Adding a condition to detect ChatGPT errors 
   - Extracting and formatting error messages using the new function
3. Fixed template string interpolation for error logging messages that were using `{this.provider}` instead of `${this.provider}`
4. Updated the library exports to include the error response formatting functions

These changes will allow you to gracefully handle ChatGPT API errors in the same way you're handling Gemini errors.


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




# This is gpt-4o-mini answer (13k in, 1k out)

To handle specific API errors from the Anthropic API gracefully, you can follow these steps:

1. **Create a new error response handler** for Anthropic similar to `getGeminiErrorResponse` and `getChatGPTErrorResponse`.
2. **Modify the `AIHttpClient` class** to use this new error handler when an error occurs.

### Step 1: Create a New Error Response Handler

Create a new file named `get-anthropic-error-response.ts` in the `lib/src` directory with the following content:

```typescript
// lib/src/get-anthropic-error-response.ts

export default function getAnthropicErrorResponse(errorMessage: string): object {
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
          content: `Anthropic API Error: ${errorMessage}`
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

### Step 2: Modify the `AIHttpClient` Class

Now, update the `AIHttpClient` class in `lib/src/ai-http-client.ts` to use this new error handler. Here’s how you can modify the `post` method:

```typescript
import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
import getGeminiErrorResponse from './get-gemini-error-response';
import getChatGPTErrorResponse from './get-chatgpt-error-response'; // Existing import
import getAnthropicErrorResponse from './get-anthropic-error-response'; // New import

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
        const axiosError = error as AxiosError<any>;

        // Handle Anthropic specific errors
        if (this.provider === 'anthropic' && axiosError.response) {
          const errorResponse = axiosError.response.data;
          if (errorResponse && errorResponse.type === 'error' && errorResponse.error) {
            const errorMessage = errorResponse.error.message;
            console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
            return getAnthropicErrorResponse(errorMessage); // Use the new error response handler
          }
        }

        // Handle ChatGPT specific errors
        if (this.provider === 'chatgpt' && axiosError.response) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getChatGPTErrorResponse(errorMessage);
        }

        // Handle Gemini specific errors
        if (this.provider === 'gemini' && axiosError.response) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getGeminiErrorResponse(errorMessage);
        }

        // Handle other errors
        if (axiosError.response) {
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

  // ... rest of the class remains unchanged
}
```

### Summary of Changes
- Created a new file `get-anthropic-error-response.ts` to handle Anthropic API errors.
- Modified the `post` method in `AIHttpClient` to use the new error handler when the provider is `anthropic`.

This will ensure that any errors from the Anthropic API are caught and formatted into a standard response structure before being returned, rather than propagating the raw error.


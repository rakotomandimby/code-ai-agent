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




# This is gemini-2.5-pro-exp-03-25 answer (16k in, 1k out)

Okay, I understand. You want to add specific error handling for the Anthropic API within the `AIHttpClient` similar to how ChatGPT and Gemini errors are handled. This involves creating a new helper function to format the error response.

Here are the steps:

1.  **Create `lib/src/get-anthropic-error-response.ts`:** This file will contain the function to generate the standardized Anthropic error response object.
2.  **Modify `lib/src/ai-http-client.ts`:** Update the `post` method to detect Anthropic API errors, extract the message, and call the new helper function.

***

**1. Create `lib/src/get-anthropic-error-response.ts`**

Create a new file named `get-anthropic-error-response.ts` inside the `lib/src` directory with the following content:

```typescript
// lib/src/get-anthropic-error-response.ts

/**
 * Generates a standardized error response object mimicking the Anthropic API structure.
 * @param errorMessage The specific error message received from the API.
 * @returns An object formatted like an Anthropic response, containing the error details.
 */
export default function getAnthropicErrorResponse(errorMessage: string): object {
  return {
    id: "msg_error", // Use a distinct ID for error responses
    type: "message",
    role: "assistant", // Maintain the expected role
    content: [
      {
        type: "text",
        // Embed the actual error message here
        text: `Anthropic API Error: ${errorMessage}`
      }
    ],
    model: "error", // Indicate that this response represents an error state
    stop_reason: "error", // Use a specific stop reason for errors
    stop_sequence: null,
    usage: {
      // Indicate zero token usage as the request likely failed
      input_tokens: 0,
      output_tokens: 0
    }
  };
}
```

**2. Modify `lib/src/ai-http-client.ts`**

Update the `post` method in `lib/src/ai-http-client.ts` to include the Anthropic error handling logic.

```typescript
// lib/src/ai-http-client.ts

import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
import getGeminiErrorResponse from './get-gemini-error-response';
import getChatGPTErrorResponse from './get-chatgpt-error-response';
// Import the new Anthropic error response generator
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
          axiosError.response?.data?.error?.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response?.status} - ${errorMessage}`);
          return getChatGPTErrorResponse(errorMessage);
        }
        // Handle Gemini specific errors
        else if (
          this.provider === 'gemini' &&
          axiosError.response?.data?.error?.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response?.status} - ${errorMessage}`);
          return getGeminiErrorResponse(errorMessage);
        }
        // Add handling for Anthropic specific errors
        else if (
          this.provider === 'anthropic' &&
          axiosError.response?.data?.error?.message // Check for the specific Anthropic error structure
        ) {
          const errorMessage = axiosError.response.data.error.message;
          const errorType = axiosError.response.data.error.type; // Optionally capture the error type
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response?.status} - Type: ${errorType} - ${errorMessage}`);
          // Call the new function to format the error response
          return getAnthropicErrorResponse(errorMessage); // Add this block
        }
        // Generic HTTP error handling
        else if (axiosError.response) {
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
      // Re-throw the error if it wasn't handled as a specific API error needing a formatted response
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

With these changes, when the `AIHttpClient` encounters an Axios error from the Anthropic API containing the expected `error.message` structure, it will now:

1.  Log the specific Anthropic error details.
2.  Call `getAnthropicErrorResponse` with the extracted message.
3.  Return the formatted error object instead of throwing the raw Axios error, allowing for graceful handling downstream.

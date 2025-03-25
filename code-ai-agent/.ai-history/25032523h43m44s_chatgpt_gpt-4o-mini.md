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




# This is gpt-4o-mini answer (13k in, 1k out)

To handle specific API errors from ChatGPT gracefully, you can follow these steps:

1. **Create a new error formatting function** similar to `getGeminiErrorResponse` for ChatGPT errors.
2. **Modify the `AIHttpClient` class** to use this new error handling function when an error occurs.

### Step 1: Create a New Error Formatting Function

Create a new file named `get-chatgpt-error-response.ts` in the `lib/src` directory with the following content:

```typescript
// lib/src/get-chatgpt-error-response.ts

export default function getChatGPTErrorResponse(errorMessage: string): object {
  return {
    id: "chatgpt-error",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "error",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `ChatGPT API Error: ${errorMessage}`,
        },
        logprobs: null,
        finish_reason: "error",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}
```

### Step 2: Modify the `AIHttpClient` Class

Now, update the `AIHttpClient` class in `lib/src/ai-http-client.ts` to use this new error handling function. Here’s how you can modify the `post` method:

```typescript
import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
import getGeminiErrorResponse from './get-gemini-error-response';
import getChatGPTErrorResponse from './get-chatgpt-error-response'; // Import the new error formatting function

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

        // Handle ChatGPT specific error response
        if (this.provider === 'chatgpt' && axiosError.response) {
          const errorMessage = axiosError.response.data.error?.message || 'Unknown error';
          console.error(`<<<<< ChatGPT API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getChatGPTErrorResponse(errorMessage); // Use the new error response function
        } else if (axiosError.response) {
          console.error(`<<<<< ${this.provider} HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`<<<<< ${this.provider} Response body: ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          console.error('----- No response received from the ${this.provider} server');
        } else {
          console.error('----- Error setting up the request to ${this.provider}:', axiosError.message);
        }
      } else {
        console.error('!!!!! Non-Axios error occurred for ${this.provider}:', error);
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

### Summary of Changes
- Created a new file `get-chatgpt-error-response.ts` to format ChatGPT error responses.
- Modified the `post` method in `AIHttpClient` to handle ChatGPT errors using the new function.

This will ensure that when a ChatGPT API error occurs, it will be caught and formatted into a standard response structure instead of propagating the raw error.


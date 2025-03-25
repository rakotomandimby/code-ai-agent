# Handle Gemini Error

When the Gemini API answers with other than an HTTP 200 status code, the response has this structure:

```json
{
  "error": {
    "code": 400,
    "message": "The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed.",
    "status": "BAD_REQUEST"
  }
}
```

I want to gracefully handle specific API errors from Gemini by catching them in the `AIHttpClient`, 
extracting the error message, and formatting it into a standard Gemini response structure before returning it, 
I prefer that instead of letting the raw error propagate.


Tell me the modifications to make to the code in order to achieve that.
In the same way I managed `getDisabledModelResponse`, prefer to use a separate file in order to get reasonable lines of code in the `AIHttpClient` class.




# This is gemini-2.5-pro-exp-03-25 answer (15k in, 1k out)

Okay, I understand. You want to intercept specific Gemini API errors within the `AIHttpClient`, format them into a standard Gemini response structure containing the error message, and return this formatted response instead of throwing the raw error. This will be done similarly to how the `disabled` model response is handled, using a separate utility function.

**1. Create `lib/src/get-gemini-error-response.ts`**

This file will contain the function to format the Gemini error into the desired response structure.

```typescript
// Create this new file: lib/src/get-gemini-error-response.ts

/**
 * Formats a Gemini API error message into a standard Gemini response structure.
 * @param errorMessage - The error message received from the Gemini API.
 * @returns An object mimicking the Gemini response structure, containing the error message.
 */
export default function getGeminiErrorResponse(errorMessage: string): object {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              // Embed the actual error message here
              text: `Gemini API Error: ${errorMessage}`,
            },
          ],
          role: 'model', // Keep the role as 'model' for consistency
        },
        // Use a specific finish reason to indicate an error occurred
        finishReason: 'ERROR',
        index: 0,
        // Include safety ratings, potentially indicating no issues as it's an API error, not content safety
        safetyRatings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            probability: 'NEGLIGIBLE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            probability: 'NEGLIGIBLE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            probability: 'NEGLIGIBLE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            probability: 'NEGLIGIBLE',
          },
        ],
      },
    ],
    // Indicate zero token usage as the request likely failed before completion
    usageMetadata: {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    },
  };
}
```

**2. Modify `lib/src/ai-http-client.ts`**

Update the `post` method to catch Axios errors, check if they are from Gemini and match the expected error structure, and use the new `getGeminiErrorResponse` function.

```typescript
// Modify this file: lib/src/ai-http-client.ts

import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
// Import the new error formatting function
import getGeminiErrorResponse from './get-gemini-error-response';

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
      // Check if it's an Axios error with a response
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>; // Use generic type for data initially

        // Check if it's a Gemini error and has the specific error structure
        if (
          this.provider === 'gemini' &&
          axiosError.response &&
          axiosError.response.data &&
          axiosError.response.data.error &&
          axiosError.response.data.error.message
        ) {
          // Extract the error message from the Gemini response
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< {this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          // Return the formatted error response using the new utility function
          return getGeminiErrorResponse(errorMessage);
        } else if (axiosError.response) {
          // Handle other Axios errors with responses
          console.error(`<<<<< {this.provider} HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`<<<<< {this.provider} Response body: ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          // Handle errors where no response was received
          console.error('----- No response received from the {this.provider} server');
        } else {
          // Handle errors in setting up the request
          console.error('----- Error setting up the request to {this.provider}:', axiosError.message);
        }
      } else {
        // Handle non-Axios errors
        console.error('!!!!! Non-Axios error occurred for {this.provider}:', error);
      }
      // Re-throw the error if it wasn't a handled Gemini API error
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

With these changes:

1.  A new file `lib/src/get-gemini-error-response.ts` is created to handle the formatting of Gemini errors.
2.  The `AIHttpClient.post` method now includes logic in its `catch` block to specifically identify Gemini API errors based on the provider and the response structure (`{ error: { message: '...' } }`).
3.  If such an error is detected, it calls `getGeminiErrorResponse` with the message from the API and returns the formatted object.
4.  Other types of errors (different API errors, network issues, non-Axios errors) are still logged and then re-thrown, maintaining the previous behavior for those cases.

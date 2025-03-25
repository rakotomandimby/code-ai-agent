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




# This is gpt-4o-mini answer (12k in, 0k out)

To handle specific API errors from the Gemini API gracefully, you can follow these steps:

1. **Create a new file for error handling**: Create a new file named `get-gemini-error-response.ts` in the `gemini-agent/src` directory. This file will contain a function to format the error response.

2. **Modify the `AIHttpClient` class**: Update the `post` method in the `AIHttpClient` class to catch errors and use the new error handling function.

Here’s how you can implement these changes:

### Step 1: Create `get-gemini-error-response.ts`

Create a new file `gemini-agent/src/get-gemini-error-response.ts` with the following content:

```typescript
// gemini-agent/src/get-gemini-error-response.ts

export default function getGeminiErrorResponse(error: any): Object {
  if (error.response && error.response.data && error.response.data.error) {
    const { code, message, status } = error.response.data.error;
    return {
      error: {
        code,
        message,
        status,
      },
    };
  }

  // Fallback for unexpected errors
  return {
    error: {
      code: 500,
      message: 'An unexpected error occurred.',
      status: 'INTERNAL_SERVER_ERROR',
    },
  };
}
```

### Step 2: Modify the `AIHttpClient` class

Update the `post` method in `gemini-agent/src/ai-http-client.ts` to handle errors using the new function:

```typescript
// gemini-agent/src/ai-http-client.ts

import { AIHttpClient } from '@code-ai-agent/lib';
import getGeminiErrorResponse from './get-gemini-error-response'; // Import the new error handling function

export class GeminiAIHttpClient extends AIHttpClient {
    constructor() {
        super('gemini');
        this.initClient();
    }

    async post(): Promise<Object> {
        if (this.model === 'disabled') {
            return getDisabledModelResponse(this.provider);
        }

        try {
            axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
            if (this.provider === 'gemini' && this.model) {
                this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
            }

            const response = await axios.post(this.url, this.body);
            return response.data;
        } catch (error) {
            // Use the new error handling function to format the error response
            const formattedError = getGeminiErrorResponse(error);
            console.error('Gemini API Error:', formattedError);
            throw formattedError; // Throw the formatted error
        }
    }
}
```

### Summary of Changes

1. **Created a new file** `get-gemini-error-response.ts` to handle error formatting.
2. **Updated the `post` method** in `GeminiAIHttpClient` to catch errors and use the new error handling function.

With these changes, the `AIHttpClient` will now gracefully handle specific API errors from the Gemini API, formatting them into a standard response structure before returning them.


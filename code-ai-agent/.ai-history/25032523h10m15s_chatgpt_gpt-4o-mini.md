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

When that happens, I want the application to build a response that looks like the usual response but puts the error message as the answer from the API.

Tell me the modifications to make to the code in order to achieve that.




# This is gpt-4o-mini answer (12k in, 0k out)

To handle the error response from the Gemini API and format it similarly to the usual response, you will need to modify the `post` method in the `AIHttpClient` class. Specifically, you will check for the error structure in the response and format it accordingly.

Here’s how you can implement this:

1. **Modify the `post` method in `AIHttpClient`**: You will need to check if the response contains an error and format it as required.

Here’s the updated code for the `post` method in `lib/src/ai-http-client.ts`:

```typescript
import axios, { AxiosError } from 'axios';

export class AIHttpClient {
  // ... existing properties and constructor

  async post(): Promise<Object> {
    if (this.model === 'disabled') {
      return this.getDisabledModelResponse();
    }

    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      // if this.provider is 'anthropic', set the api version headers
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
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          // Check if the response has an error structure
          if (axiosError.response.data.error) {
            const errorResponse = axiosError.response.data.error;
            return {
              id: "error-response",
              object: "chat.completion",
              created: Math.floor(Date.now() / 1000),
              model: this.model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: errorResponse.message // Use the error message from the API
                  },
                  logprobs: null,
                  finish_reason: "error"
                }
              ],
              usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
              }
            };
          } else {
            console.error(`HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
            console.error(`Response body: ${JSON.stringify(axiosError.response.data)}`);
          }
        } else if (axiosError.request) {
          console.error('No response received from the server');
        } else {
          console.error('Error setting up the request');
        }
      } else {
        console.error('Non-Axios error occurred:', error);
      }
      throw error;
    }
  }

  // ... existing methods
}
```

### Explanation of Changes:
- **Error Handling**: In the `catch` block, after checking if the error is an Axios error, we check if the response contains an `error` object.
- **Formatting the Response**: If the error object exists, we construct a response that mimics the usual response structure but includes the error message from the API.

### Next Steps:
- Ensure that you test this modification to verify that the error handling works as expected when the Gemini API returns an error response.
- You may also want to add unit tests to cover this new error handling behavior. 

Let me know if you need further assistance!


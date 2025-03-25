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




# This is claude-3-7-sonnet-latest answer (16k in, 2k out)

# Handle Gemini Error Response

To handle Gemini API errors and convert them into formatted responses that match the expected structure, we need to modify the `AIHttpClient` class. We'll need to catch the specific error format from Gemini and transform it into a response that mimics a successful response but contains the error message.

Here's the implementation:

```typescript
import axios, { AxiosError } from 'axios';

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
          console.error(`HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`Response body: ${JSON.stringify(axiosError.response.data)}`);
          
          // Handle Gemini API error specifically
          if (this.provider === 'gemini' && axiosError.response.data && 
              typeof axiosError.response.data === 'object' && 'error' in axiosError.response.data) {
            // Create a formatted error response that matches the Gemini response structure
            return this.createGeminiErrorResponse(axiosError.response.data);
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

  // New method to create a Gemini-formatted error response
  protected createGeminiErrorResponse(errorData: any): Object {
    const errorMessage = errorData.error?.message || 'Unknown Gemini API error';
    const errorCode = errorData.error?.code || 500;
    const errorStatus = errorData.error?.status || 'UNKNOWN_ERROR';
    
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: `Error (${errorCode} - ${errorStatus}): ${errorMessage}`
              }
            ],
            role: "model"
          },
          finishReason: "ERROR",
          index: 0,
          safetyRatings: [
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              probability: "NEGLIGIBLE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              probability: "NEGLIGIBLE"
            },
            {
              category: "HARM_CATEGORY_HARASSMENT",
              probability: "NEGLIGIBLE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              probability: "NEGLIGIBLE"
            }
          ]
        }
      ],
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      }
    };
  }

  protected getDisabledModelResponse(): Object {
    if (this.provider === 'chatgpt') {
      return {
        id: "model-disabled",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "disabled",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "This model is currently disabled."
            },
            logprobs: null,
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        system_fingerprint: "disabled"
      };
    } else if (this.provider === 'gemini') {
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "This model is currently disabled."
                }
              ],
              role: "model"
            },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_HARASSMENT",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                probability: "NEGLIGIBLE"
              }
            ]
          }
        ],
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0
        }
      };
    } else if (this.provider === 'anthropic') {
      return {
        id: "msg_disabled",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "This model is currently disabled."
          }
        ],
        model: "disabled",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };
    }

    // Generic fallback response
    return {
      status: "disabled",
      message: "This model is currently disabled."
    };
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

The main changes I've made are:

1. Added a new method `createGeminiErrorResponse()` that formats Gemini API errors into a response structure that resembles a successful response
2. Modified the error handling in the `post()` method to detect Gemini-specific errors and convert them to the expected format
3. The error response maintains the same format as a successful response, but contains the error message in the text field and uses "ERROR" as the finishReason

This implementation will ensure that when the Gemini API returns an error, your application will still receive a properly formatted response with the error details incorporated into the text content.


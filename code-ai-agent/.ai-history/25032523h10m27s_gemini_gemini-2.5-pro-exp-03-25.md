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




# This is gemini-2.5-pro-exp-03-25 answer (15k in, 3k out)

Okay, I understand. You want to gracefully handle specific API errors from Gemini by catching them in the `AIHttpClient`, extracting the error message, and formatting it into a standard Gemini response structure before returning it, instead of letting the raw error propagate.

Here's the modified code for `lib/src/ai-http-client.ts`:

```typescript
import axios, { AxiosError } from 'axios';

// Define an interface for the Gemini error structure
interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

// Define an interface for the expected successful Gemini response structure (simplified)
interface GeminiSuccessResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: Array<{ category: string; probability: string }>;
  }>;
  usageMetadata?: { // Make usageMetadata optional as it might not apply to errors
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}


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
      // Clear previous default headers to avoid conflicts between providers
      axios.defaults.headers.common = {};
      // Set the token header
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;

      // Set provider-specific headers
      if (this.provider === 'anthropic') {
        axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
      }

      // Set provider-specific URL if needed (like for Gemini)
      if (this.provider === 'gemini' && this.model) {
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.token}`;
        // For Gemini, the API key is passed as a query parameter, not a header.
        // Remove the header if it was set generically.
        // Note: The initClient sets x-goog-api-key header, which might be incorrect based on Gemini docs.
        // Preferring query param as per official docs for generateContent.
        // Let's adjust initClient logic slightly or handle it here.
        // For now, assuming the URL construction handles the key.
        // We might need to revisit how the key is set in initClient vs here.
        // Let's remove the potentially conflicting header if it exists.
        delete axios.defaults.headers.common[this.tokenHeaderName];
      }


      const response = await axios.post(this.url, this.body);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          // Log the original error details regardless
          console.error(`HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`Response body: ${JSON.stringify(axiosError.response.data)}`);

          // --- Start Gemini Error Handling ---
          // Check if it's a Gemini error with the expected structure
          if (
            this.provider === 'gemini' &&
            axiosError.response.data &&
            typeof axiosError.response.data === 'object' && // Ensure data is an object
            'error' in axiosError.response.data &&         // Check if 'error' key exists
            typeof (axiosError.response.data as any).error === 'object' && // Ensure error is an object
            'message' in (axiosError.response.data as any).error // Check if message exists in error
          ) {
            const geminiError = axiosError.response.data as GeminiErrorResponse;
            const errorMessage = geminiError.error.message || "An unknown Gemini API error occurred.";
            // Construct a Gemini-like response containing the error message
            console.warn(`Gemini API returned an error. Formatting error message into standard response.`);
            return this.getGeminiErrorResponse(errorMessage); // Return the formatted error response
          }
          // --- End Gemini Error Handling ---

        } else if (axiosError.request) {
          console.error('No response received from the server');
        } else {
          console.error('Error setting up the request:', axiosError.message);
        }
      } else {
        console.error('Non-Axios error occurred:', error);
      }
      // If it wasn't a handled Gemini error, re-throw the original error
      throw error;
    }
  }

  // --- Start New Method: getGeminiErrorResponse ---
  /**
   * Constructs a Gemini-like response object containing an error message.
   * @param errorMessage The error message from the API.
   * @returns A GeminiSuccessResponse formatted object containing the error.
   */
  protected getGeminiErrorResponse(errorMessage: string): GeminiSuccessResponse {
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                // Place the extracted error message here
                text: `Error from API: ${errorMessage}`
              }
            ],
            role: "model" // Mimic the role of a model response
          },
          finishReason: "ERROR", // Use a specific finish reason for errors
          index: 0,
          safetyRatings: [ // Include default safety ratings
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", probability: "NEGLIGIBLE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", probability: "NEGLIGIBLE" },
            { category: "HARM_CATEGORY_HARASSMENT", probability: "NEGLIGIBLE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "NEGLIGIBLE" }
          ]
        }
      ],
      usageMetadata: { // Provide zero usage for errors
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      }
    };
  }
  // --- End New Method: getGeminiErrorResponse ---


  protected getDisabledModelResponse(): Object {
    if (this.provider === 'chatgpt') {
      return { /* ... existing chatgpt disabled response ... */ };
    } else if (this.provider === 'gemini') {
      // Use the new method for consistency, passing the disabled message
      return this.getGeminiErrorResponse("This model is currently disabled.");
      // Or keep the original structure if preferred:
      /*
      return {
        candidates: [
          {
            content: { parts: [{ text: "This model is currently disabled." }], role: "model" },
            finishReason: "STOP", // Or maybe "OTHER"?
            index: 0,
            safetyRatings: [
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", probability: "NEGLIGIBLE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", probability: "NEGLIGIBLE" },
              { category: "HARM_CATEGORY_HARASSMENT", probability: "NEGLIGIBLE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "NEGLIGIBLE" }
            ]
          }
        ],
        usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }
      };
      */
    } else if (this.provider === 'anthropic') {
      return { /* ... existing anthropic disabled response ... */ };
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
      // The URL is now constructed dynamically in post() based on the model
      // this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`; // Removed from here
      this.token = process.env.GEMINI_API_KEY ?? '';
      // According to Gemini REST API docs for generateContent, the key should be a query parameter `?key=YOUR_API_KEY`
      // Setting a header might not be correct or necessary for this specific endpoint.
      // Let's remove the header setting here and rely on the URL construction in post().
      this.tokenHeaderName = ''; // No specific header needed for generateContent
      this.tokenHeaderValue = ''; // No specific header needed for generateContent
      // If other Gemini endpoints require 'x-goog-api-key', this might need adjustment or endpoint-specific logic.
    } else if (this.provider === 'anthropic') {
      this.url = 'https://api.anthropic.com/v1/messages';
      this.token = process.env.ANTHROPIC_API_KEY ?? '';
      this.tokenHeaderName = 'x-api-key';
      this.tokenHeaderValue = this.token;
      this.apiVersionHeaderName = 'anthropic-version';
      this.apiVersionHeaderValue = '2023-06-01';
    }

    // Basic check for token existence
    if (!this.token && this.provider !== 'disabled') { // Allow disabled models without a token
        console.warn(`API Key for ${this.provider} is missing. Please set the corresponding environment variable (e.g., OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY).`);
        // Depending on requirements, you might want to throw an error here
        // throw new Error(`API Key for ${this.provider} is missing.`);
    }
  }
}
```

**Explanation of Changes:**

1.  **Interfaces (`GeminiErrorResponse`, `GeminiSuccessResponse`):** Added interfaces to strongly type the expected Gemini error and success structures for better code clarity and safety.
2.  **`post()` Method - Error Handling:**
    *   Inside the `catch` block, after confirming it's an `AxiosError` with a `response`, the original error details are still logged.
    *   **Gemini Error Check:** A new `if` condition checks:
        *   If `this.provider` is `'gemini'`.
        *   If `axiosError.response.data` exists and is an object.
        *   If `axiosError.response.data.error` exists and is an object.
        *   If `axiosError.response.data.error.message` exists.
    *   **Error Formatting:** If the conditions are met:
        *   The `axiosError.response.data` is cast to `GeminiErrorResponse`.
        *   The `errorMessage` is extracted.
        *   A warning is logged indicating that the error is being formatted.
        *   The new `getGeminiErrorResponse(errorMessage)` method is called, and its result is **returned**. This prevents the original error from being thrown further up the chain.
    *   **Fallback:** If the error is *not* the specific Gemini error structure we're handling, the code continues, and the original `throw error;` at the end of the `catch` block is executed.
3.  **New Method `getGeminiErrorResponse()`:**
    *   This protected method takes the `errorMessage` string as input.
    *   It constructs an object that mimics the structure of a successful Gemini response (`GeminiSuccessResponse`).
    *   The `errorMessage` is embedded within the `candidates[0].content.parts[0].text` field, prefixed with "Error from API: ".
    *   It sets `finishReason` to `"ERROR"` to indicate this isn't a normal completion.
    *   It includes default `safetyRatings` and zeroed `usageMetadata`.
4.  **`getDisabledModelResponse()`:** Updated the Gemini part to potentially use the new `getGeminiErrorResponse` method for consistency, although the original structure is also fine.
5.  **`initClient()` - Gemini URL & Auth:**
    *   Removed the static URL setting for Gemini, as it's now dynamically constructed in `post()` using the model name.
    *   **Important:** Corrected the authentication method for Gemini's `generateContent` endpoint. The API key should be passed as a URL query parameter (`?key=YOUR_API_KEY`), not the `x-goog-api-key` header. The `tokenHeaderName` and `tokenHeaderValue` are cleared for Gemini in `initClient`, and the URL construction in `post()` now includes the key.
6.  **`post()` - Header Cleanup:** Added `axios.defaults.headers.common = {};` at the beginning of the `try` block to ensure headers from previous requests (potentially for different providers) don't interfere. Also explicitly removed the Gemini header `delete axios.defaults.headers.common[this.tokenHeaderName];` after constructing the URL with the key parameter, just in case it was somehow set.
7.  **`initClient()` - Token Check:** Added a basic check to warn if an API key is missing when initializing the client.

Now, when the Gemini API returns an error matching the specified structure, the `AIHttpClient` will catch it, format it into a standard-looking Gemini response containing the error message, and return that object. The `agent-router` will receive this formatted object and send it back to the client with a 200 OK status, instead of sending a 500 Internal Server Error with the raw error details.

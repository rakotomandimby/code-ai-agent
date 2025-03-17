# Problem: Gemini used model is always the one in the URL 

With this code base, I think the Gemini model that is used is always the one mentioned in its URL.
Do you confirm this?




# This is gemini-2.0-pro-exp answer (14k in, 0k out)

You are absolutely correct.  The Gemini model used is hardcoded in `lib/src/ai-http-client.ts` within the `initClient` method:

```typescript
// ... other code
} else if (this.provider === 'gemini') {
  this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';
  // ... other code
}
// ... other code

```

The URL explicitly specifies `gemini-1.5-pro-latest`.  Therefore, regardless of what you send in the request body for `model_to_use`, it will be ignored.

To fix this, you need to dynamically construct the URL based on the selected model.

Here's how you can modify the `lib/src/ai-http-client.ts` file to address this:

```typescript
import axios, { AxiosError } from 'axios';

export class AIHttpClient {
  // ... existing code ...

  protected initClient() {
    if (this.provider === 'chatgpt') {
      // ... existing code ...
    } else if (this.provider === 'gemini') {
      // Construct the URL dynamically
      this.constructGeminiUrl();
      this.token = process.env.GEMINI_API_KEY ?? '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
    } else if (this.provider === 'anthropic') {
      // ... existing code ...
    }
  }

  private constructGeminiUrl() {
    // Default to 'gemini-1.5-pro-latest' if no model is specified
    let model = 'gemini-1.5-pro-latest'; 

    // Check if a model has been set in the body
    if (this.body && typeof this.body === 'object' && 'model' in this.body) {
      model = this.body['model'];
    }
    this.url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }
}
```

Key changes:

1. **`constructGeminiUrl()` method:** This new method is responsible for building the Gemini URL.  It defaults to `gemini-1.5-pro-latest` but checks the `this.body` for a `model` property. If present, it uses that value to construct the URL.

2. **Call `constructGeminiUrl()`:** The `initClient` method now calls `constructGeminiUrl()` to set the `this.url` correctly.

3. **Access `model` in `this.body`:** The `constructGeminiUrl` method now safely accesses the `model` property within `this.body` using a type guard and the `in` operator.


With this change, the Gemini agent will use the model specified in the request body.  If no model is provided, it will default to `gemini-1.5-pro-latest`.  Remember to rebuild your application after making these changes.  Let me know if you have any other questions.


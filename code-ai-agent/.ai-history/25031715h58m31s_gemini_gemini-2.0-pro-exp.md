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
```

This line sets the URL to always use `gemini-1.5-pro-latest`.  The `model_to_use` property sent in the request body is never actually used to change the model.

To fix this, you need to dynamically construct the URL based on the selected model.

Here's how you can modify the `initClient` method in `lib/src/ai-http-client.ts`:

```typescript
protected initClient() {
    // ... other code

  } else if (this.provider === 'gemini') {
    this.token = process.env.GEMINI_API_KEY ?? '';
    this.tokenHeaderName = 'x-goog-api-key';
    this.tokenHeaderValue = this.token;
  } else if (this.provider === 'anthropic') {
    // ... existing anthropic code
  }
}

private geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/';

async getGeminiUrl(model: string): Promise<string> {
  if (!model) {
    // Default model if none is provided
    model = 'gemini-1.5-pro-latest'; // Or any other default
  }
  return `${this.geminiBaseUrl}${model}:generateContent`;
}


async post(): Promise<Object> {
  try {
    if (this.provider === 'gemini') {
      const modelToUse = await this.getSetting('model_to_use'); // Assuming you have a getSetting method similar to others
      this.url = await this.getGeminiUrl(modelToUse);
    }
    // ... rest of your existing post method code
```

You also need to add the `getSetting` method to the `AIHttpClient` class:

```typescript
protected async getSetting(setting: string): Promise<string> {
  // Implement your logic to retrieve the setting.
  // This might involve accessing a database or other storage mechanism.
  // For now, let's assume it's stored in a local variable:
  const settings = {
    'model_to_use': 'gemini-1.5-pro', // Default value
  };
  return settings[setting] || '';
}
```

Now, the `post` method will dynamically build the URL for Gemini requests based on the `model_to_use` setting.  Remember to implement the actual logic for retrieving the setting in the `getSetting` method according to your application's needs.  You'll likely want to access the repository there.  You'll also need to add the `model_to_use` field to the request body if you're not already sending it.


With these changes, the Gemini agent will use the model specified in the request, allowing you to switch between different Gemini models.  If no model is specified, it will default to `gemini-1.5-pro-latest` (or your chosen default).

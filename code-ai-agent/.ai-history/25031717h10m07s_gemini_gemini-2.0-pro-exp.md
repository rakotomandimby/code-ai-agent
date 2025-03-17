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

This line sets the URL to always use `gemini-1.5-pro-latest`.  The code *does* retrieve the `model_to_use` from the repository, but it never actually *uses* this value to modify the Gemini request.

To fix this, you need to incorporate the `model_to_use` into the URL.

Here's the corrected `initClient` function for `lib/src/ai-http-client.ts`:

```typescript
protected initClient() {
    if (this.provider === 'chatgpt') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.token = process.env.OPENAI_API_KEY ?? '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
    } else if (this.provider === 'gemini') {
      // The model will be set later based on user input
      this.url = 'https://generativelanguage.googleapis.com/v1beta/models/'; 
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
```

And here's the updated `post` function:

```typescript
async post(): Promise<Object> {
    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      // if this.provider is 'anthropic', set the api version headers
      if (this.provider === 'anthropic') {
        axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
      }

      if (this.provider === 'gemini') {
        const modelToUse = await repository.getModelToUse(); // Assuming repository is accessible here. Consider passing it as an argument.
        this.url += `${modelToUse}:generateContent`; // Append the model to the base URL
      }

      const response = await axios.post(this.url, this.body);
      return response.data;
    } catch (error) { // ... (rest of error handling code remains unchanged)
```

Key changes:

1. **Base URL:** The `initClient` function now sets a base URL for Gemini without a specific model.

2. **Dynamic Model Appending:** The `post` function now retrieves the `model_to_use` from the repository and appends it to the base URL just before making the request.

3. **Repository Access:** The `post` function now needs access to the `repository` to get the model.  The cleanest way to do this is to pass the `repository` instance as an argument to the `post` function.  You'll need to adjust the calling code accordingly.  Alternatively, if the `repository` is readily available in the scope of the `AIHttpClient` class, you can use it directly.


With these changes, the Gemini agent will use the model specified in the request body.  Remember to rebuild your application after making these changes.


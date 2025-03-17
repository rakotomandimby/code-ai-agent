# Problem: Gemini used model is always the one in the URL 

With this code base, I think the Gemini model that is used is always the one mentioned in its URL.
Propose me the code changes that would allow me to use the model that I want by specifying it in the request URL.

# This is gemini-2.0-pro-exp answer (13k in, 0k out)

You're right, the Gemini model is hardcoded in the `GeminiAIHttpClient`.  We need to make it dynamic based on the request. Here's how you can modify the code to achieve this:

1. **Modify `lib/src/agent-router.ts` to pass the model to the AIHttpClient:**

```typescript
// lib/src/agent-router.ts
// ... other imports

export function createAgentRouter(
  // ... other params
): Router {
  // ... other code

  router.post(`/${agentName}`, async (req: Request, res: Response) => {
    // ... other code

    setTimeout(async () => {
      try {
        // ... other code

        console.log(`>>>>> ${agentName} ${modelToUse} has been queried`);
        const aiHttpClient = new aiHttpClientConstructor();
        aiHttpClient.setBody(agentBody.getBody());
        aiHttpClient.setModel(modelToUse); // Pass the model here
        const response = await aiHttpClient.post();

        // ... rest of the code
      } catch (error) {
        // ... error handling
      }
    }, 1000);

    // ... rest of the code
  });

  return router;
}

```

2. **Modify `lib/src/ai-http-client.ts` to accept and use the model:**

```typescript
// lib/src/ai-http-client.ts
// ... other imports

export class AIHttpClient {
  // ... existing properties
  protected model: string | undefined;


  constructor(provider: string) {
    // ... existing constructor code
    this.model = undefined; // Initialize model
  }

  // Add a setter for the model
  setModel(model: string) {
    this.model = model;
  }

  async post(): Promise<Object> {
    try {
      // ... existing code

      let requestUrl = this.url;

      if (this.provider === 'gemini' && this.model) {
        requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      }

      const response = await axios.post(requestUrl, this.body);
      return response.data;

      // ... existing code
    } catch (error) {
      // ... error handling
    }
  }

  // ... rest of the class
}
```

3.  **Send the model in the request body:**

Now, when making a request to the `/gemini` endpoint, include the desired model name in the request body under the key `model_to_use`:

```json
{
  "model_to_use": "gemini-pro", // or any other valid Gemini model name
  "system_instruction": "You are a helpful assistant.",
  "content": "Write a short story about a robot learning to love."
}
```

With these changes, the Gemini agent will use the model specified in the request body. If no model is provided, it will likely default to the base URL in the `initClient` method (which you might want to change to a reasonable default).  Make sure to handle potential errors if an invalid model name is provided.

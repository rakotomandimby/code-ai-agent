# Problem: Gemini used model is always the one in the URL 

With this code base, I think the Gemini model that is used is always the one mentioned in its URL.
Do you confirm this?




# This is gpt-4o-mini answer (12k in, 0k out)

Yes, based on the provided code, it appears that the Gemini model used is indeed always the one specified in the URL within the `GeminiAIHttpClient` class. 

### Explanation

In the `gemini-agent/src/ai-http-client.ts` file, the URL for the Gemini API is hardcoded as follows:

```typescript
this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';
```

This means that the request will always be sent to the `gemini-1.5-pro-latest` model, as there is no mechanism in place to dynamically change the model based on user input or configuration.

### Suggested Changes

To allow for dynamic model selection, you could modify the `GeminiAIHttpClient` class to accept a model parameter and update the URL accordingly. Here’s an example of how you might implement this:

1. **Modify the Constructor**: Update the constructor to accept a model name.

```typescript
export class GeminiAIHttpClient extends AIHttpClient {
    constructor(model: string) {
        super('gemini');
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        this.initClient();
    }
}
```

2. **Update the Router**: When creating the `GeminiAIHttpClient` instance in the router, pass the desired model name.

For example, in `gemini-agent/src/routes.ts`, you could modify the code to retrieve the model from the request body:

```typescript
router.post(`/${agentName}`, async (req: Request, res: Response) => {
    // ... existing code ...

    const modelToUse = JSONBody.model_to_use || 'gemini-1.5-pro-latest'; // Default model
    const aiHttpClient = new GeminiAIHttpClient(modelToUse);
    aiHttpClient.setBody(agentBody.getBody());
    const response = await aiHttpClient.post();
    res.send(response);
    // ... existing code ...
});
```

### Conclusion

By implementing these changes, you can allow the Gemini model to be specified dynamically, rather than being hardcoded in the URL. This will enable more flexibility in your application and allow users to select different models as needed.


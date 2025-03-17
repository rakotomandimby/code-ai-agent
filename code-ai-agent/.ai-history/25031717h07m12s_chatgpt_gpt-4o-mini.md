# Problem: Gemini used model is always the one in the URL 

With this code base, I think the Gemini model that is used is always the one mentioned in its URL.
Do you confirm this?




# This is gpt-4o-mini answer (12k in, 0k out)

Yes, based on the provided code, it appears that the Gemini model used is indeed always the one specified in the URL. 

### Explanation

In the `GeminiAIHttpClient` class, the URL for the Gemini API is hardcoded as follows:

```typescript
this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';
```

This means that the client will always send requests to this specific model (`gemini-1.5-pro-latest`) when making API calls.

### Suggested Changes

If you want to allow for dynamic selection of the Gemini model, you would need to modify the `GeminiAIHttpClient` class to accept a model parameter and adjust the URL accordingly. Here’s how you could do it:

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

2. **Update the Router**: When creating the `GeminiAIHttpClient` instance in your routes, pass the desired model name.

For example, in `gemini-agent/src/routes.ts`, you could modify the router to accept a model name from the request body:

```typescript
router.post(`/${agentName}`, async (req: Request, res: Response) => {
    // ... existing code ...

    const modelToUse = JSONBody.model_to_use || 'gemini-1.5-pro-latest'; // Default to the original model if not provided
    const aiHttpClient = new GeminiAIHttpClient(modelToUse);
    aiHttpClient.setBody(agentBody.getBody());
    const response = await aiHttpClient.post();
    res.send(response);
    // ... existing code ...
});
```

### Conclusion

By making these changes, you can allow the Gemini model to be specified dynamically rather than being hardcoded in the URL. This will give you the flexibility to use different models as needed.


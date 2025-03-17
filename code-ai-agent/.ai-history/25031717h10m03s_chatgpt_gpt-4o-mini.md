# Problem: Gemini used model is always the one in the URL 

With this code base, I think the Gemini model that is used is always the one mentioned in its URL.
Do you confirm this?




# This is gpt-4o-mini answer (12k in, 0k out)

Yes, you are correct. In the provided code base, the Gemini model that is used is indeed hardcoded in the URL within the `GeminiAIHttpClient` class. Specifically, the URL is set to:

```typescript
this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';
```

This means that the model being used is always `gemini-1.5-pro-latest`, as it is directly specified in the code. 

### Suggested Changes

If you want to allow for dynamic selection of the Gemini model, you would need to modify the `GeminiAIHttpClient` class to accept a model parameter and adjust the URL accordingly. Here’s how you could do it:

1. **Modify the Constructor**: Update the constructor to accept a model name.

2. **Update the URL**: Construct the URL using the provided model name.

### Example Code

Here’s an example of how you might implement this:

```typescript
import { AIHttpClient } from '@code-ai-agent/lib';

export class GeminiAIHttpClient extends AIHttpClient {
    constructor(model: string) {
        super('gemini');
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        this.initClient();
    }
}
```

### Update Usage

When creating an instance of `GeminiAIHttpClient`, you would now pass the desired model name:

```typescript
const modelToUse = 'your-desired-model-name'; // Replace with the actual model name
const aiHttpClient = new GeminiAIHttpClient(modelToUse);
```

### Conclusion

By making these changes, you can dynamically select which Gemini model to use based on your application's requirements.


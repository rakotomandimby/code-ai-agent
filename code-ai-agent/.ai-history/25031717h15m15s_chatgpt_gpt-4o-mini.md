# Problem: Gemini used model is always the one in the URL 

With this code base, I think the Gemini model that is used is always the one mentioned in its URL.
Propose me the code changes that would allow me to use the model that I want by specifying it in the request URL.



# This is gpt-4o-mini answer (12k in, 1k out)

To allow the Gemini model to be specified in the request URL, you will need to modify the `GeminiBody` class to accept a model parameter and update the `GeminiAIHttpClient` to use this model when making requests. Here’s how you can implement these changes:

### Step 1: Update `GeminiBody` to Accept Model in the Request

Modify the `getBody` method in `gemini-agent/src/model/gemini-body.ts` to accept a model parameter. You can add a method to set the model directly from the request.

**Updated `gemini-body.ts`:**
```typescript
import { MultiTurnChat } from '@code-ai-agent/lib';

export default class GeminiBody {
  private multiTurnChat: MultiTurnChat = new MultiTurnChat();
  private chunks: any;
  private systemInstruction: string;
  private model: string;

  private sexuallyExplicit = { category : 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold : 'BLOCK_NONE' };
  private hateSpeech       = { category : 'HARM_CATEGORY_HATE_SPEECH',       threshold : 'BLOCK_NONE' };
  private harassment       = { category : 'HARM_CATEGORY_HARASSMENT',        threshold : 'BLOCK_NONE' };
  private dangerousContent = { category : 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold : 'BLOCK_NONE' };
  private safetySettings   = [this.sexuallyExplicit, this.hateSpeech, this.harassment, this.dangerousContent];
  private generationConfig = {temperature : 0.2, topP : 0.5}

  constructor() {
    this.chunks= [];
    this.systemInstruction = '';
  }

  public setModelToUse(modelToUse: string) {
    this.model = modelToUse;
  }

  public setSystemInstruction(systemInstruction: string) {
    this.systemInstruction = systemInstruction;
  }

  public setTemperature(temperature: number) {
    this.generationConfig.temperature = temperature;
  }

  public setTopP(topP: number) {
    this.generationConfig.topP = topP;
  }

  public setMultiTurnChat(multiTurnChat: MultiTurnChat) {
    this.multiTurnChat = multiTurnChat;
    let rows = this.multiTurnChat.getRows();
    for (let i = 0; i < rows.length; i++) {
      this.chunks.push({role: rows[i].role, parts: [{text: rows[i].content}]});
    }
  }

  getBody() {
    return {
      system_instruction: { parts : { text : this.systemInstruction}},
      contents: this.chunks,
      safetySettings: this.safetySettings,
      generationConfig: this.generationConfig,
      model: this.model // Include the model in the body
    }
  }
}
```

### Step 2: Update the Route to Accept Model from the Request

In the `gemini-agent/src/routes.ts`, modify the route handler to extract the model from the request body and set it in the `GeminiBody`.

**Updated `routes.ts`:**
```typescript
import express, { Router } from 'express';
import GeminiRepository from './repository/gemini-repository';
import { GeminiAIHttpClient } from './ai-http-client';
import { createAgentRouter } from '@code-ai-agent/lib'; // Adjust import as necessary
import GeminiBody from './model/gemini-body';

const router: Router = createAgentRouter(
  new GeminiRepository(),
  'gemini',
  GeminiAIHttpClient,
  GeminiBody // Adjust as necessary
);

router.post('/gemini', async (req, res) => {
  const { model, system_instruction, temperature, top_p, contents } = req.body;

  const geminiBody = new GeminiBody();
  geminiBody.setModelToUse(model); // Set the model from the request
  geminiBody.setSystemInstruction(system_instruction);
  geminiBody.setTemperature(temperature);
  geminiBody.setTopP(top_p);
  
  // Assuming contents is an array of messages
  const multiTurnChat = new MultiTurnChat();
  multiTurnChat.appendUniquely(contents);
  geminiBody.setMultiTurnChat(multiTurnChat);

  // Continue with the rest of the logic...
  // Call the AIHttpClient with the geminiBody
});

export default router;
```

### Step 3: Update the AIHttpClient to Use the Model

In the `lib/src/ai-http-client.ts`, ensure that the request to the Gemini API uses the model specified in the body.

**Updated `ai-http-client.ts`:**
```typescript
async post(): Promise<Object> {
  try {
    axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
    if (this.provider === 'anthropic') {
      axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
    }
    const response = await axios.post(this.url, this.body);
    return response.data;
  } catch (error) {
    // Error handling remains the same
  }
}

// Ensure the initClient method is still setting the URL correctly
protected initClient() {
  if (this.provider === 'gemini') {
    this.url = 'https://generativelanguage.googleapis.com/v1beta/models/' + this.body.model + ':generateContent'; // Use the model from the body
    this.token = process.env.GEMINI_API_KEY ?? '';
    this.tokenHeaderName = 'x-goog-api-key';
    this.tokenHeaderValue = this.token;
  }
}
```

### Summary

With these changes, you can now specify the desired Gemini model in the request body when making a POST request to the `/gemini` endpoint. The `GeminiBody` class will include this model in the request sent to the Gemini API, allowing you to use different models as needed. 

Make sure to test the changes thoroughly to ensure that the model is being set correctly and that the API responds as expected.


import { AIHttpClient } from '@code-ai-agent/lib';

export class GeminiAIHttpClient extends AIHttpClient {
    constructor() {
        super('gemini');
        this.initClient();
    }
}

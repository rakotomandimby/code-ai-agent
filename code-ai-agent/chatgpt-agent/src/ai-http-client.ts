import { AIHttpClient } from '@code-ai-agent/lib';

export class ChatGPTAIHttpClient extends AIHttpClient {
    constructor() {
        super('chatgpt');
        this.initClient();
    }
}

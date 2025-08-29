import { AIHttpClient } from '@code-ai-agent/lib';

export class OpenAIAIHttpClient extends AIHttpClient {
    constructor() {
        super('openai');
    }
}

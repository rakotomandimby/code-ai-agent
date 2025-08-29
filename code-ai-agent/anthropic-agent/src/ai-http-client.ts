import { AIHttpClient } from '@code-ai-agent/lib';

export class AnthropicAIHttpClient extends AIHttpClient {
    constructor() {
        super('anthropic');
    }
}

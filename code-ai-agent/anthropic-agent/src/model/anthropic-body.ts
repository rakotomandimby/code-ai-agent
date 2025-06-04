import { MultiTurnChat } from '@code-ai-agent/lib';

export default class AnthropicBody {
  private multiTurnChat: MultiTurnChat = new MultiTurnChat();
  private chunks: any;
  private model: string;
  private systemInstruction: string;

  constructor() {
    this.chunks= [];
    this.model = '';
    this.systemInstruction = '';
  }

  public setMultiTurnChat(multiTurnChat: MultiTurnChat) {
    this.multiTurnChat = multiTurnChat;
    let rows = this.multiTurnChat.getRows();
    for (let i = 0; i < rows.length; i++) {
      let r= rows[i];
      let role = r.role;
      let content = r.content;
      if (r.role === 'model') {role='assistant';}
      this.chunks.push({role: role, content: content});
    }
  }

  public setSystemInstruction(systemInstruction: string) {
    this.systemInstruction = systemInstruction;
  }

  public setModelToUse(modelToUse: string) {
    this.model = modelToUse;
  }

  public setTemperature(temperature: number) {
  }

  public setTopP(topP: number) {
  }

  public getBody() {
    return {
      max_tokens: 32000,
      messages : this.chunks,
      system: this.systemInstruction,
      model : this.model,
    }
  }

}


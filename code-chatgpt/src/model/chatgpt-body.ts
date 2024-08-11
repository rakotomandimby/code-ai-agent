import { MultiTurnChat } from './multiturnchat';

export default class ChatGPTBody {
  private multiTurnChat: MultiTurnChat = new MultiTurnChat();
  private chunks: any;
  private model: string;
  private temperature: number;
  private topP: number;

  constructor() {
    this.chunks= [];
    this.model = '';
    this.temperature = 0.2;
    this.topP = 0.1;
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
    this.chunks.unshift({role: 'system', content: systemInstruction});
  }
  
  public setModelToUse(modelToUse: string) {
    this.model = modelToUse;
  }

  public setTemperature(temperature: number) {
    this.temperature = temperature;
  }

  public setTopP(topP: number) {
    this.topP = topP;
  }

  public getBody() {
    return {
      messages : this.chunks, 
      model : this.model,
      temperature : this.temperature,
      top_p : this.topP,
    }
  }

}


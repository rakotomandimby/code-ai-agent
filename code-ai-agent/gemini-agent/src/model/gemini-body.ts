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
      generationConfig: this.generationConfig
    }
  }

}


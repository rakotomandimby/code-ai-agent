import axios from 'axios';

export default class AIHttpClient {
  private provider: string;
  private url: string;
  private debugUrl: string;
  private body: object;
  private token: string;
  private tokenHeaderName: string;
  private tokenHeaderValue: string;

  constructor(provider: string) {
    this.provider = provider;
    this.body = {};
    this.url = '';
    this.debugUrl = '';
    this.token = '';
    this.tokenHeaderName = '';
    this.tokenHeaderValue = '';
    if (this.provider === 'gemini') {
      this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent'
      this.debugUrl = 'https://eowloffrpvxwtqp.m.pipedream.net/debug/v1beta/models/gemini-1.5-pro-latest:generateContent'
      this.token = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY : '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
    }
  }

  setBody(body: object) {
    this.body = body;
  }

  async post(): Promise<Object> {
    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      const response = await axios.post(this.url, this.body);
      return response.data;
    } catch (error) {
      console.error(`${this.provider} in catch: ${error}`);
      throw error; 
    }
  }
}

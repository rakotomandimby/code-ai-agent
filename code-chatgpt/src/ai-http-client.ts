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
    if (this.provider === 'chatgpt') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.debugUrl = 'https://eowloffrpvxwtqp.m.pipedream.net/debug/v1/chat/completions'
      this.token = process.env.OPENAI_API_KEY? process.env.OPENAI_API_KEY : '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
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

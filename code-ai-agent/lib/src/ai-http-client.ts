import axios, { AxiosError } from 'axios';

export class AIHttpClient {
  protected provider: string;
  protected url: string;
  protected body: object;
  protected token: string;
  protected tokenHeaderName: string;
  protected tokenHeaderValue: string;

  constructor(provider: string) {
    this.provider = provider;
    this.body = {};
    this.url = '';
    this.token = '';
    this.tokenHeaderName = '';
    this.tokenHeaderValue = '';
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
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.error(`HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`Response body: ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          console.error('No response received from the server');
        } else {
          console.error('Error setting up the request');
        }
      } else {
        console.error('Non-Axios error occurred:', error);
      }
      throw error;
    }
  }

  protected initClient() {
    if (this.provider === 'chatgpt') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.token = process.env.OPENAI_API_KEY ?? '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
    } else if (this.provider === 'gemini') {
      this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';
      this.token = process.env.GEMINI_API_KEY ?? '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
    }
  }
}


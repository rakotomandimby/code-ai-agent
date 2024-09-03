import axios from 'axios';
import { AxiosError } from 'axios';

export default class AIHttpClient {
  private provider: string;
  private url: string;
  private body: object;
  private token: string;
  private tokenHeaderName: string;
  private tokenHeaderValue: string;

  constructor(provider: string) {
    this.provider = provider;
    this.body = {};
    this.url = '';
    this.token = '';
    this.tokenHeaderName = '';
    this.tokenHeaderValue = '';
    if (this.provider === 'gemini') {
      this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent'
      // this.url = 'https://eowloffrpvxwtqp.m.pipedream.net/debug/v1beta/models/gemini-1.5-pro-latest:generateContent'
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
}

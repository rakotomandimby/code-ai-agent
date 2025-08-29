import axios, { AxiosError } from 'axios';
import getDisabledModelResponse from './get-disabled-model-response';
import getGoogleAIErrorResponse from './get-googleai-error-response';
import getOpenAIErrorResponse from './get-openai-error-response';
import getAnthropicErrorResponse from './get-anthropic-error-response';

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
  protected apiKey: string | null = null;

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

  setApiKey(key: string | null) {
    this.apiKey = key;
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

    if (!this.apiKey) {
      const errorMessage = `API key is missing. Please provide it in the 'api_key' field of your request body.`;
      console.error(`<<<<< ${this.provider} API Error: ${errorMessage}`);
      if (this.provider === 'openai') return getOpenAIErrorResponse(errorMessage);
      if (this.provider === 'googleai') return getGoogleAIErrorResponse(errorMessage);
      if (this.provider === 'anthropic') return getAnthropicErrorResponse(errorMessage);
      throw new Error(errorMessage);
    }

    this.initClient();

    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      if (this.provider === 'anthropic') {
        axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
      }
      if (this.provider === 'googleai' && this.model) {
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        this.debugURL = `https://eo95iwu8zyev9gb.m.pipedream.net/v1beta/models/${this.model}:generateContent`;
      }

      const response = await axios.post(this.url, this.body);
      // axios.post(this.debugURL, this.body);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;

        if (
          this.provider === 'openai' &&
          axiosError.response?.data?.error?.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getOpenAIErrorResponse(errorMessage);
        } else if (
          this.provider === 'googleai' &&
          axiosError.response?.data?.error?.message
        ) {
          const errorMessage = axiosError.response.data.error.message;
          console.error(`<<<<< ${this.provider} API Error: ${axiosError.response.status} - ${errorMessage}`);
          return getGoogleAIErrorResponse(errorMessage);
        } else if (
          this.provider === 'anthropic' &&
          axiosError.response?.data?.error?.message
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
    if (this.provider === 'openai') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.debugURL = 'https://eo95iwu8zyev9gb.m.pipedream.net/v1/chat/completions';
      this.token = this.apiKey ?? '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
    } else if (this.provider === 'googleai') {
      this.token = this.apiKey ?? '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
    } else if (this.provider === 'anthropic') {
      this.url = 'https://api.anthropic.com/v1/messages';
      this.debugURL = 'https://eo95iwu8zyev9gb.m.pipedream.net/v1/messages';
      this.token = this.apiKey ?? '';
      this.tokenHeaderName = 'x-api-key';
      this.tokenHeaderValue = this.token;
      this.apiVersionHeaderName = 'anthropic-version';
      this.apiVersionHeaderValue = '2023-06-01';
    }
  }
}


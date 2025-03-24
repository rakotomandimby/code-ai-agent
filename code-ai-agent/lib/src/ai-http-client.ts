import axios, { AxiosError } from 'axios';

export class AIHttpClient {
  protected provider: string;
  protected url: string;
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
  }

  setBody(body: object) {
    this.body = body;
  }
  setModel(model: string) {
    this.model = model;
  }

  async post(): Promise<Object> {
    if (this.model === 'disabled') {
      return this.getDisabledModelResponse();
    }

    try {
      axios.defaults.headers.common[this.tokenHeaderName] = this.tokenHeaderValue;
      // if this.provider is 'anthropic', set the api version headers
      if (this.provider === 'anthropic') {
        axios.defaults.headers.common[this.apiVersionHeaderName] = this.apiVersionHeaderValue;
      }
      if (this.provider === 'gemini' && this.model) {
        this.url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      }

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

  protected getDisabledModelResponse(): Object {
    if (this.provider === 'chatgpt') {
      return {
        id: "model-disabled",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "disabled",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "This model is currently disabled."
            },
            logprobs: null,
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        system_fingerprint: "disabled"
      };
    } else if (this.provider === 'gemini') {
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "This model is currently disabled."
                }
              ],
              role: "model"
            },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_HARASSMENT",
                probability: "NEGLIGIBLE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                probability: "NEGLIGIBLE"
              }
            ]
          }
        ],
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0
        }
      };
    } else if (this.provider === 'anthropic') {
      return {
        id: "msg_disabled",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "This model is currently disabled."
          }
        ],
        model: "disabled",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };
    }

    // Generic fallback response
    return {
      status: "disabled",
      message: "This model is currently disabled."
    };
  }

  protected initClient() {
    if (this.provider === 'chatgpt') {
      this.url = 'https://api.openai.com/v1/chat/completions';
      this.token = process.env.OPENAI_API_KEY ?? '';
      this.tokenHeaderName = 'Authorization';
      this.tokenHeaderValue = `Bearer ${this.token}`;
    } else if (this.provider === 'gemini') {
      this.token = process.env.GEMINI_API_KEY ?? '';
      this.tokenHeaderName = 'x-goog-api-key';
      this.tokenHeaderValue = this.token;
    } else if (this.provider === 'anthropic') {
      this.url = 'https://api.anthropic.com/v1/messages';
      this.token = process.env.ANTHROPIC_API_KEY ?? '';
      this.tokenHeaderName = 'x-api-key';
      this.tokenHeaderValue = this.token;
      this.apiVersionHeaderName = 'anthropic-version';
      this.apiVersionHeaderValue = '2023-06-01';
    }
  }
}


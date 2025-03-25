  export default function getDisabledModelResponse(provider: string): Object {
    if (provider === 'chatgpt') {
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
    } else if (provider === 'gemini') {
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
    } else if (provider === 'anthropic') {
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


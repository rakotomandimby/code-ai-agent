export default function getOpenAIErrorResponse(errorMessage: string): object {
  return {
    id: "error-response",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "error",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `OpenAI API Error: ${errorMessage}`
        },
        logprobs: null,
        finish_reason: "error"
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    },
    system_fingerprint: "error"
  };
}


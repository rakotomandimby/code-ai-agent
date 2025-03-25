export default function getAnthropicErrorResponse(errorMessage: string): object {
  return {
    id: "error-response",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: `Anthropic API Error: ${errorMessage}`
      }
    ],
    model: "error",
    stop_reason: "error",
    usage: {
      input_tokens: 0,
      output_tokens: 0
    }
  };
}


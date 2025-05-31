export default function getGoogleAIErrorResponse(errorMessage: string): object {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              // Embed the actual error message here
              text: `GoogleAI API Error: ${errorMessage}`,
            },
          ],
          role: 'model', // Keep the role as 'model' for consistency
        },
        // Use a specific finish reason to indicate an error occurred
        finishReason: 'ERROR',
        index: 0,
        // Include safety ratings, potentially indicating no issues as it's an API error, not content safety
        safetyRatings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            probability: 'NEGLIGIBLE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            probability: 'NEGLIGIBLE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            probability: 'NEGLIGIBLE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            probability: 'NEGLIGIBLE',
          },
        ],
      },
    ],
    // Indicate zero token usage as the request likely failed before completion
    usageMetadata: {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    },
  };
}


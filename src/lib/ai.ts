import Anthropic from "@anthropic-ai/sdk";

/**
 * One model, one client. Effort is tuned per call site (extraction runs at
 * "low" so an on-the-fly scan of six church sites finishes while a person is
 * still reading the chat; the conversation itself runs at "medium").
 */
export const MODEL = process.env.BELONG_MODEL ?? "claude-opus-5";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Turn SDK errors into a sentence a nervous person can read. */
export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy — try again in a moment.";
  if (error instanceof Anthropic.AuthenticationError) return "AI features are misconfigured on this deployment.";
  if (error instanceof Anthropic.APIError) return `The AI service returned an error (${error.status}).`;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

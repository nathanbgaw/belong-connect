import Anthropic from "@anthropic-ai/sdk";

/**
 * One client, two model slots. Extraction (reading a church site into a
 * structured inventory) and the chat can run on different models; both
 * default to Sonnet, which is a quarter of Opus's price and holds up well on
 * this work. Override per deployment with BELONG_MODEL_CHAT / BELONG_MODEL_EXTRACT.
 */
export const MODEL_CHAT = process.env.BELONG_MODEL_CHAT ?? process.env.BELONG_MODEL ?? "claude-sonnet-5";
export const MODEL_EXTRACT = process.env.BELONG_MODEL_EXTRACT ?? process.env.BELONG_MODEL ?? "claude-sonnet-5";
/** Kept for callers that only need "a model"; equals the extraction model. */
export const MODEL = MODEL_EXTRACT;

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

// ── usage accounting ────────────────────────────────────────────────────────

export interface Usage {
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export function emptyUsage(): Usage {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

export function addUsage(u: Usage, m: Anthropic.Message | { usage: Anthropic.Usage }): Usage {
  u.calls += 1;
  u.input += m.usage.input_tokens ?? 0;
  u.output += m.usage.output_tokens ?? 0;
  u.cacheRead += m.usage.cache_read_input_tokens ?? 0;
  u.cacheWrite += m.usage.cache_creation_input_tokens ?? 0;
  return u;
}

/** Per-million-token list prices, for a rough cost readout in logs and the UI. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCost(u: Usage, model: string): number {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5"];
  // cache writes cost 1.25×, cache reads 0.1× of the input price
  return (u.input * p.input + u.cacheWrite * p.input * 1.25 + u.cacheRead * p.input * 0.1 + u.output * p.output) / 1_000_000;
}

export function describeUsage(u: Usage, model: string): string {
  return `${model}: ${u.calls} call${u.calls === 1 ? "" : "s"}, ${u.input.toLocaleString()} in + ${u.cacheRead.toLocaleString()} cached + ${u.output.toLocaleString()} out ≈ $${estimateCost(u, model).toFixed(3)}`;
}

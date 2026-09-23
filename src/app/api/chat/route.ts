import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { sseResponse } from "@/lib/sse";
import { runChatTurn } from "@/lib/chat";
import { aiEnabled, describeAiError } from "@/lib/ai";
import { dbEnabled } from "@/lib/db";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST { message, history } → SSE
 *   status  { text }          progress while tools run
 *   delta   { text }          streamed answer text
 *   done    { text, history, churches, place }
 *   error   { error }
 *
 * `history` is the full Anthropic message array from the previous turn,
 * returned verbatim by `done` — the client holds the conversation state, the
 * server holds nothing.
 */
export async function POST(request: Request) {
  if (!aiEnabled() || !dbEnabled()) {
    return NextResponse.json({ error: "This deployment is missing ANTHROPIC_API_KEY or Supabase settings." }, { status: 503 });
  }
  let body: { message?: string; history?: Anthropic.MessageParam[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  if (!message) return NextResponse.json({ error: "Say what you need first." }, { status: 400 });
  const history = Array.isArray(body.history) ? body.history.slice(-40) : [];

  return sseResponse(async (send) => {
    try {
      const result = await runChatTurn(history, message, {
        status: (text) => send("status", { text }),
        delta: (text) => send("delta", { text }),
      });
      send("done", result);
    } catch (e) {
      send("error", { error: describeAiError(e) });
    }
  });
}

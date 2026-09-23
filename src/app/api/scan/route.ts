import { NextResponse } from "next/server";
import { sseResponse } from "@/lib/sse";
import { scanChurch, ScanError } from "@/lib/scan";
import { aiEnabled } from "@/lib/ai";
import { dbEnabled } from "@/lib/db";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST { url, force? } → SSE
 *   status  { text }
 *   done    { church, resources, cached }
 *   error   { error, church? }
 */
export async function POST(request: Request) {
  if (!aiEnabled() || !dbEnabled()) {
    return NextResponse.json({ error: "This deployment is missing ANTHROPIC_API_KEY or Supabase settings." }, { status: 503 });
  }
  let body: { url?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "Paste a church website address first." }, { status: 400 });

  return sseResponse(async (send) => {
    try {
      const result = await scanChurch(url, { force: Boolean(body.force), onStatus: (text) => send("status", { text }) });
      send("done", result);
    } catch (e) {
      if (e instanceof ScanError) send("error", { error: e.message, church: e.church });
      else send("error", { error: e instanceof Error ? e.message : "Something went wrong." });
    }
  });
}

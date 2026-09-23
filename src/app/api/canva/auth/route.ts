import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { authorizeUrl, canvaConfigured, pkcePair } from "@/lib/canva";

export const dynamic = "force-dynamic";

/** GET /api/canva/auth?return=/churches/slug → redirect to Canva's consent screen. */
export async function GET(request: Request) {
  if (!canvaConfigured()) return NextResponse.json({ error: "Canva is not configured on this deployment." }, { status: 503 });
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return") ?? "/";
  const { verifier, challenge } = pkcePair();
  const state = randomBytes(16).toString("base64url");
  const redirectUri = `${url.origin}/api/canva/callback`;
  const jar = await cookies();
  const opts = { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("canva_pkce", verifier, opts);
  jar.set("canva_state", state, opts);
  jar.set("canva_return", returnTo.startsWith("/") ? returnTo : "/", opts);
  return NextResponse.redirect(authorizeUrl({ challenge, state, redirectUri }));
}

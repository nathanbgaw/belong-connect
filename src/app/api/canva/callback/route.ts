import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/canva";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const returnTo = jar.get("canva_return")?.value ?? "/";
  if (!code || !state || state !== jar.get("canva_state")?.value) {
    return NextResponse.redirect(new URL(`${returnTo}?canva=denied`, url.origin));
  }
  try {
    const tok = await exchangeCode({ code, verifier: jar.get("canva_pkce")?.value ?? "", redirectUri: `${url.origin}/api/canva/callback` });
    jar.set("canva_token", tok.access_token, {
      httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: Math.max(60, tok.expires_in - 60),
    });
    jar.delete("canva_pkce");
    jar.delete("canva_state");
    return NextResponse.redirect(new URL(`${returnTo}?canva=connected`, url.origin));
  } catch (e) {
    return NextResponse.redirect(new URL(`${returnTo}?canva=error&msg=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`, url.origin));
  }
}

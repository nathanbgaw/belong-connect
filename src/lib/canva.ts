import { createHash, randomBytes } from "node:crypto";

/**
 * Canva Connect API — "Add to Canva".
 *
 * Needs a Canva integration (developer portal → Integrations): set
 * CANVA_CLIENT_ID and CANVA_CLIENT_SECRET, and register
 * `https://<your-host>/api/canva/callback` as the redirect URL with scopes
 * design:content:write and design:meta:read. Without them the UI falls back to
 * "download the PPTX and drag it into Canva", which Canva imports natively.
 *
 * Tokens live in an httpOnly cookie on the visitor's browser; the server
 * stores nothing.
 */

export const CANVA_SCOPES = ["design:content:write", "design:meta:read"];
const AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const IMPORT_URL = "https://api.canva.com/rest/v1/imports";

export function canvaConfigured(): boolean {
  return Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
}

export function pkcePair() {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(opts: { challenge: string; state: string; redirectUri: string }): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("code_challenge", opts.challenge);
  u.searchParams.set("code_challenge_method", "s256");
  u.searchParams.set("scope", CANVA_SCOPES.join(" "));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.CANVA_CLIENT_ID!);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  return u.toString();
}

export async function exchangeCode(opts: { code: string; verifier: string; redirectUri: string }) {
  const basic = Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      code_verifier: opts.verifier,
      redirect_uri: opts.redirectUri,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Canva token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export interface CanvaImportResult {
  designId: string;
  editUrl: string;
  viewUrl: string;
  title: string;
}

/** Upload a PPTX and wait for Canva to turn it into an editable design. */
export async function importPptx(accessToken: string, title: string, pptx: Buffer): Promise<CanvaImportResult> {
  const meta = JSON.stringify({
    title_base64: Buffer.from(title.slice(0, 50)).toString("base64"),
    mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const start = await fetch(IMPORT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/octet-stream", "Import-Metadata": meta },
    body: new Uint8Array(pptx),
  });
  if (!start.ok) throw new Error(`Canva import failed (${start.status}): ${await start.text()}`);
  let job = ((await start.json()) as { job: CanvaJob }).job;

  for (let i = 0; i < 40 && job.status === "in_progress"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`${IMPORT_URL}/${job.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!poll.ok) throw new Error(`Canva import poll failed (${poll.status})`);
    job = ((await poll.json()) as { job: CanvaJob }).job;
  }
  if (job.status !== "success" || !job.result?.designs?.[0]) {
    throw new Error(job.error?.message ?? "Canva did not finish importing the design.");
  }
  const d = job.result.designs[0];
  return { designId: d.id, editUrl: d.urls.edit_url, viewUrl: d.urls.view_url, title: d.title ?? title };
}

interface CanvaJob {
  id: string;
  status: "in_progress" | "success" | "failed";
  result?: { designs: { id: string; title?: string; urls: { edit_url: string; view_url: string } }[] };
  error?: { code: string; message: string };
}

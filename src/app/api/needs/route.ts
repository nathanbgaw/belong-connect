import { NextResponse } from "next/server";
import { createNeed, listNeeds } from "@/lib/db";
import { CATEGORIES } from "@/lib/categories";
import { lookupZip, normalizeZip } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET() {
  const needs = await listNeeds(100);
  // Never expose contact details on the public board.
  return NextResponse.json({ needs: needs.map(({ contact: _c, ...n }) => ({ ...n, has_contact: Boolean(_c) })) });
}

export async function POST(request: Request) {
  let body: { zip?: string; category?: string; description?: string; contact_ok?: boolean; contact?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const description = (body.description ?? "").trim();
  const category = (CATEGORIES as readonly string[]).includes(body.category ?? "") ? body.category! : "other";
  if (description.length < 8) return NextResponse.json({ error: "Tell us a little more about what you need." }, { status: 400 });
  if (description.length > 2000) return NextResponse.json({ error: "That's a bit long — 2,000 characters max." }, { status: 400 });
  const zip = body.zip ? normalizeZip(body.zip) : null;
  const place = zip ? await lookupZip(zip) : null;
  const need = await createNeed({
    zip,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    category,
    description,
    contact_ok: Boolean(body.contact_ok),
    contact: body.contact_ok && body.contact ? String(body.contact).slice(0, 200) : null,
  });
  return NextResponse.json({ need: { ...need, contact: undefined } });
}

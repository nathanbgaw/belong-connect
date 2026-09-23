import { NextResponse } from "next/server";
import { createOffer, listOffers } from "@/lib/db";
import { CATEGORIES } from "@/lib/categories";
import { lookupZip, normalizeWebsite, normalizeZip } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET() {
  const offers = await listOffers(100);
  return NextResponse.json({ offers: offers.map(({ contact_email: _e, ...o }) => ({ ...o, has_contact: Boolean(_e) })) });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const s = (k: string, max = 300) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const church_name = s("church_name", 160);
  const description = s("description", 2000);
  const category = (CATEGORIES as readonly string[]).includes(s("category")) ? s("category") : "other";
  if (church_name.length < 2) return NextResponse.json({ error: "Which church is this?" }, { status: 400 });
  if (description.length < 8) return NextResponse.json({ error: "Say a little about what you can provide." }, { status: 400 });
  const zip = normalizeZip(s("zip"));
  const place = zip ? await lookupZip(zip) : null;
  const offer = await createOffer({
    church_name,
    website: s("website") ? normalizeWebsite(s("website")) : null,
    contact_name: s("contact_name", 120) || null,
    contact_email: s("contact_email", 200) || null,
    zip,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    category,
    description,
  });
  return NextResponse.json({ offer: { ...offer, contact_email: undefined } });
}

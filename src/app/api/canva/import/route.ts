import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canvaConfigured, importPptx } from "@/lib/canva";
import { getChurchBySlug, resourcesForChurch } from "@/lib/db";
import { deckForChurch } from "@/lib/deck";
import { deckToPptx } from "@/lib/pptx";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** POST { slug } → { editUrl } — builds the church deck and imports it into the visitor's Canva. */
export async function POST(request: Request) {
  if (!canvaConfigured()) return NextResponse.json({ error: "Canva is not configured on this deployment." }, { status: 503 });
  const token = (await cookies()).get("canva_token")?.value;
  if (!token) return NextResponse.json({ error: "Connect Canva first.", connect: true }, { status: 401 });
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const church = body.slug ? await getChurchBySlug(body.slug) : null;
  if (!church) return NextResponse.json({ error: "No such church." }, { status: 404 });
  const deck = deckForChurch(church, await resourcesForChurch(church.id));
  try {
    const result = await importPptx(token, deck.title, await deckToPptx(deck));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Canva import failed." }, { status: 502 });
  }
}

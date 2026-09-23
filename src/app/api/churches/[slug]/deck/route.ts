import { NextResponse } from "next/server";
import { getChurchBySlug, resourcesForChurch } from "@/lib/db";
import { deckForChurch } from "@/lib/deck";
import { deckToPptx } from "@/lib/pptx";
import { deckToPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/** GET /api/churches/{slug}/deck?format=pptx|pdf */
export async function GET(request: Request, ctx: RouteContext<"/api/churches/[slug]/deck">) {
  const { slug } = await ctx.params;
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "pptx";
  const church = await getChurchBySlug(slug);
  if (!church) return NextResponse.json({ error: "No such church." }, { status: 404 });
  const deck = deckForChurch(church, await resourcesForChurch(church.id));
  const buf = format === "pdf" ? await deckToPdf(deck) : await deckToPptx(deck);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `${new URL(request.url).searchParams.get("inline") ? "inline" : "attachment"}; filename="${deck.fileStem}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { getChurchesBySlugs, resourcesForChurches } from "@/lib/db";
import { deckForNearby } from "@/lib/deck";
import { deckToPptx } from "@/lib/pptx";
import { deckToPdf } from "@/lib/pdf";
import { haversineMiles, lookupZip } from "@/lib/geo";
import { nearbyChurches } from "@/lib/osm";
import type { NearbyChurch } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { need, zip, slugs, format } → a "churches near you" deck as pptx or pdf. */
export async function POST(request: Request) {
  let body: { need?: string; zip?: string; slugs?: string[]; format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const format = body.format === "pdf" ? "pdf" : "pptx";
  const place = body.zip ? await lookupZip(body.zip) : null;
  if (!place) return NextResponse.json({ error: "A zip code is needed to build this deck." }, { status: 400 });
  const slugs = Array.isArray(body.slugs) ? body.slugs.map(String).slice(0, 12) : [];
  const churches = await getChurchesBySlugs(slugs);
  const resources = await resourcesForChurches(churches.map((c) => c.id));
  const all = await nearbyChurches(place.lat, place.lng, 8).catch(() => [] as NearbyChurch[]);

  const picked = churches
    .map((c) => {
      const d = c.lat != null && c.lng != null ? haversineMiles(place.lat, place.lng, c.lat, c.lng) : 0;
      const nc: NearbyChurch = {
        key: c.host ?? c.slug, name: c.name, website: c.website, host: c.host, lat: c.lat ?? 0, lng: c.lng ?? 0,
        distanceMiles: d, address: c.address, phone: c.phone, denomination: c.denomination, scanned: c,
      };
      return { church: nc, resources: resources.filter((r) => r.church_id === c.id) };
    })
    .sort((a, b) => a.church.distanceMiles - b.church.distanceMiles);

  const pickedHosts = new Set(churches.map((c) => c.host));
  const deck = deckForNearby({
    need: (body.need ?? "Help nearby").slice(0, 200),
    placeLabel: `${place.city}, ${place.state} ${place.zip}`,
    churches: picked,
    unscannedWithSites: all.filter((c) => c.website && !pickedHosts.has(c.host) && c.scanned?.status !== "scanned"),
    noSite: all.filter((c) => !c.website),
  });
  const buf = format === "pdf" ? await deckToPdf(deck) : await deckToPptx(deck);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${deck.fileStem}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}

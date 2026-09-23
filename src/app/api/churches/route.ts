import { NextResponse } from "next/server";
import { recentChurches, resourcesForChurches } from "@/lib/db";
import { lookupZip } from "@/lib/geo";
import { nearbyChurches } from "@/lib/osm";

export const dynamic = "force-dynamic";

/** GET /api/churches            → recently scanned churches with resource counts
 *  GET /api/churches?zip=21061  → churches near a zip (scanned + OpenStreetMap) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip");
  if (zip) {
    const place = await lookupZip(zip);
    if (!place) return NextResponse.json({ error: "That zip code didn't resolve." }, { status: 400 });
    const radius = Math.min(25, Math.max(2, Number(searchParams.get("radius") ?? 8)));
    const churches = await nearbyChurches(place.lat, place.lng, radius);
    return NextResponse.json({ place, radius, churches });
  }
  const churches = await recentChurches(200);
  const resources = await resourcesForChurches(churches.map((c) => c.id));
  const counts = new Map<string, number>();
  for (const r of resources) counts.set(r.church_id, (counts.get(r.church_id) ?? 0) + 1);
  return NextResponse.json({
    churches: churches.map((c) => ({
      slug: c.slug, name: c.name, city: c.city, state: c.state, zip: c.zip, website: c.website, tags: c.tags,
      lat: c.lat, lng: c.lng, resourceCount: counts.get(c.id) ?? 0, scanned_at: c.scanned_at, summary: c.summary,
    })),
  });
}

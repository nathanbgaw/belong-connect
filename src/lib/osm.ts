import { cacheGet, cacheSet, churchesInBox } from "./db";
import { boundingBox, haversineMiles, normalizeHost, normalizeWebsite } from "./geo";
import type { ChurchRow, NearbyChurch } from "./types";

/**
 * Churches near a point, from OpenStreetMap's Overpass API — free, keyless,
 * and honest about its gaps: plenty of congregations are mapped without a
 * website tag, and some aren't mapped at all. Results are cached for a week
 * because Overpass is a shared community resource.
 *
 * Set GOOGLE_PLACES_API_KEY to layer Google Places on top (better coverage of
 * websites and phone numbers); without it, OSM alone carries the demo.
 */

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OsmChurch {
  osmId: string;
  name: string;
  website: string | null;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  denomination: string | null;
}

function tidyDenomination(d?: string): string | null {
  if (!d) return null;
  return d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function addressOf(t: Record<string, string>): string | null {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const rest = [t["addr:city"], t["addr:state"], t["addr:postcode"]].filter(Boolean).join(", ");
  const s = [street, rest].filter(Boolean).join(", ");
  return s || null;
}

export async function osmChurchesNear(lat: number, lng: number, radiusMiles: number): Promise<OsmChurch[]> {
  const key = `osm:${lat.toFixed(2)},${lng.toFixed(2)},${radiusMiles}`;
  const cached = await cacheGet<OsmChurch[]>(key, 7 * 24 * 3600 * 1000).catch(() => null);
  if (cached) return cached;

  const meters = Math.round(radiusMiles * 1609.34);
  const query = `[out:json][timeout:40];
nwr["amenity"="place_of_worship"]["religion"="christian"](around:${meters},${lat},${lng});
out center tags 400;`;

  let elements: OsmElement[] = [];
  let lastError: string | null = null;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "BelongConnect/0.1 (church resource directory demo)",
          Accept: "*/*",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const json = (await res.json()) as { elements: OsmElement[] };
      elements = json.elements ?? [];
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "fetch failed";
    }
  }
  if (elements.length === 0 && lastError) {
    throw new Error(`OpenStreetMap lookup failed (${lastError}).`);
  }

  const seen = new Set<string>();
  const out: OsmChurch[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    if (!t.name) continue;
    const p = el.center ?? (el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : null);
    if (!p) continue;
    const website = normalizeWebsite(t.website ?? t["contact:website"] ?? t.url ?? "") ?? null;
    const dedupe = website ? normalizeHost(website)! : `${t.name.toLowerCase()}|${p.lat.toFixed(3)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      osmId: `${el.type}/${el.id}`,
      name: t.name,
      website,
      lat: p.lat,
      lng: p.lon,
      address: addressOf(t),
      phone: t.phone ?? t["contact:phone"] ?? null,
      denomination: tidyDenomination(t.denomination),
    });
  }
  await cacheSet(key, out).catch(() => {});
  return out;
}

/**
 * Merge OSM results with what we've already scanned into one ranked list:
 * scanned churches with resources first, then unscanned churches with a
 * website (scannable on the fly), then churches with no website at all.
 */
export async function nearbyChurches(lat: number, lng: number, radiusMiles: number): Promise<NearbyChurch[]> {
  const [osm, known] = await Promise.all([
    osmChurchesNear(lat, lng, radiusMiles).catch(() => [] as OsmChurch[]),
    churchesInBox(boundingBox(lat, lng, radiusMiles)).catch(() => [] as ChurchRow[]),
  ]);

  const byHost = new Map<string, ChurchRow>();
  for (const c of known) if (c.host) byHost.set(c.host, c);

  const list: NearbyChurch[] = [];
  const used = new Set<string>();

  for (const c of osm) {
    const host = c.website ? normalizeHost(c.website) : null;
    const scanned = host ? byHost.get(host) ?? null : null;
    const key = host ?? c.osmId;
    used.add(key);
    list.push({
      key,
      name: scanned?.name ?? c.name,
      website: scanned?.website ?? c.website,
      host,
      lat: c.lat,
      lng: c.lng,
      distanceMiles: haversineMiles(lat, lng, c.lat, c.lng),
      address: scanned?.address ?? c.address,
      phone: scanned?.phone ?? c.phone,
      denomination: scanned?.denomination ?? c.denomination,
      scanned,
    });
  }
  // Churches we scanned that OSM doesn't know about (entered by URL, or offered by a church).
  for (const c of known) {
    if (!c.host || used.has(c.host) || c.lat == null || c.lng == null) continue;
    const d = haversineMiles(lat, lng, c.lat, c.lng);
    if (d > radiusMiles) continue;
    list.push({
      key: c.host,
      name: c.name,
      website: c.website,
      host: c.host,
      lat: c.lat,
      lng: c.lng,
      distanceMiles: d,
      address: c.address,
      phone: c.phone,
      denomination: c.denomination,
      scanned: c,
    });
  }

  const rank = (c: NearbyChurch) => (c.scanned?.status === "scanned" ? 0 : c.website ? 1 : 2);
  list.sort((a, b) => rank(a) - rank(b) || a.distanceMiles - b.distanceMiles);
  return list;
}

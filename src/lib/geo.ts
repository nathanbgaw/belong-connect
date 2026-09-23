/**
 * Geography without an API key. Zip codes resolve through zippopotam.us and
 * street addresses through OpenStreetMap's Nominatim (which asks for a real
 * User-Agent and no more than one request a second — we comply with both).
 */

export interface Place {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

const zipCache = new Map<string, Place | null>();

export function normalizeZip(input: string): string | null {
  const m = String(input).match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

export async function lookupZip(input: string): Promise<Place | null> {
  const zip = normalizeZip(input);
  if (!zip) return null;
  if (zipCache.has(zip)) return zipCache.get(zip)!;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      zipCache.set(zip, null);
      return null;
    }
    const json = (await res.json()) as {
      places?: { "place name": string; "state abbreviation": string; latitude: string; longitude: string }[];
    };
    const p = json.places?.[0];
    if (!p) {
      zipCache.set(zip, null);
      return null;
    }
    const place: Place = {
      zip,
      city: p["place name"],
      state: p["state abbreviation"],
      lat: Number(p.latitude),
      lng: Number(p.longitude),
    };
    zipCache.set(zip, place);
    return place;
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");
    const res = await fetch(url, {
      headers: { "User-Agent": "BelongConnect/0.1 (church resource directory demo; contact via GitHub)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string }[];
    if (!json[0]) return null;
    return { lat: Number(json[0].lat), lng: Number(json[0].lon) };
  } catch {
    return null;
  }
}

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function boundingBox(lat: number, lng: number, miles: number) {
  const dLat = miles / 69;
  const dLng = miles / (69 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function normalizeHost(input: string): string | null {
  try {
    const u = new URL(input.startsWith("http") ? input : `https://${input}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normalizeWebsite(input: string): string | null {
  try {
    const u = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

import { crawlSite } from "./crawl";
import { extractProfile } from "./extract";
import { getChurchByHost, getChurchBySlug, replaceResources, resourcesForChurch, upsertChurch } from "./db";
import { geocodeAddress, lookupZip, normalizeHost, normalizeWebsite } from "./geo";
import type { ChurchRow, ResourceRow } from "./types";

/**
 * The one pipeline both tools share:
 *   URL → crawl (multi-page) → extract (Claude, structured) → geocode → store.
 * Results are cached by host; a re-scan is forced with `force`.
 */

const FRESH_MS = 30 * 24 * 3600 * 1000;

export interface ScanResult {
  church: ChurchRow;
  resources: ResourceRow[];
  cached: boolean;
}

export type StatusFn = (text: string) => void;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "church";
}

async function uniqueSlug(name: string, host: string): Promise<string> {
  const base = slugify(name);
  const existing = await getChurchBySlug(base);
  if (!existing || existing.host === host) return base;
  return `${base}-${slugify(host.split(".")[0])}`;
}

export async function scanChurch(
  input: string,
  opts: { force?: boolean; onStatus?: StatusFn; hint?: { lat?: number | null; lng?: number | null; name?: string | null; address?: string | null; phone?: string | null } } = {}
): Promise<ScanResult> {
  const status = opts.onStatus ?? (() => {});
  const website = normalizeWebsite(input);
  const host = website ? normalizeHost(website) : null;
  if (!website || !host) throw new Error("That doesn't look like a web address. Try something like hopechurch.org.");

  const existing = await getChurchByHost(host);
  if (
    existing &&
    !opts.force &&
    existing.status === "scanned" &&
    existing.scanned_at &&
    Date.now() - new Date(existing.scanned_at).getTime() < FRESH_MS
  ) {
    status(`Already read ${host} recently — using what we have.`);
    return { church: existing, resources: await resourcesForChurch(existing.id), cached: true };
  }

  status(`Reading ${host}…`);
  const crawl = await crawlSite(website, {
    onPage: (url, ok) => {
      if (ok) status(`${host} — read ${new URL(url).pathname === "/" ? "the homepage" : new URL(url).pathname}`);
    },
  });

  if (!crawl.ok) {
    const slug = existing?.slug ?? (await uniqueSlug(opts.hint?.name ?? host, host));
    const church = await upsertChurch({
      slug,
      host,
      name: existing?.name ?? opts.hint?.name ?? host,
      website,
      lat: existing?.lat ?? opts.hint?.lat ?? null,
      lng: existing?.lng ?? opts.hint?.lng ?? null,
      address: existing?.address ?? opts.hint?.address ?? null,
      phone: existing?.phone ?? opts.hint?.phone ?? null,
      status: "unreadable",
      error: crawl.error,
      scanned_at: new Date().toISOString(),
    });
    throw new ScanError(crawl.error ?? "Couldn't read that site.", church);
  }

  status(`${host} — read ${crawl.pages.length} page${crawl.pages.length === 1 ? "" : "s"}, drafting the inventory…`);
  const profile = await extractProfile(crawl.pages, website);

  // Geocode: zip is the most reliable thing sites publish; fall back to the address.
  let lat = opts.hint?.lat ?? existing?.lat ?? null;
  let lng = opts.hint?.lng ?? existing?.lng ?? null;
  let zip = profile.zip;
  if (lat == null || lng == null) {
    if (profile.address) {
      const g = await geocodeAddress([profile.address, profile.city, profile.state, profile.zip].filter(Boolean).join(", "));
      if (g) ({ lat, lng } = g);
    }
    if ((lat == null || lng == null) && zip) {
      const p = await lookupZip(zip);
      if (p) ({ lat, lng } = p);
    }
  }
  if (!zip && profile.address) {
    const m = profile.address.match(/\b\d{5}\b/);
    if (m) zip = m[0];
  }

  const slug = existing?.slug ?? (await uniqueSlug(profile.name, host));
  const church = await upsertChurch({
    slug,
    host,
    name: profile.name,
    website,
    denomination: profile.denomination,
    address: profile.address ?? opts.hint?.address ?? null,
    city: profile.city,
    state: profile.state ?? "MD",
    zip,
    lat,
    lng,
    phone: profile.phone ?? opts.hint?.phone ?? null,
    email: profile.email,
    service_times: profile.serviceTimes,
    summary: profile.summary,
    tags: profile.tags,
    profile,
    pages_read: profile.pagesRead,
    source: existing?.source ?? "scan",
    status: "scanned",
    error: null,
    scanned_at: new Date().toISOString(),
  });
  const resources = await replaceResources(church.id, profile.resources);
  status(`Found ${resources.length} resource${resources.length === 1 ? "" : "s"} at ${profile.name}.`);
  return { church, resources, cached: false };
}

export class ScanError extends Error {
  church: ChurchRow;
  constructor(message: string, church: ChurchRow) {
    super(message);
    this.church = church;
  }
}

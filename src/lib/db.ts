import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChurchRow, ResourceRow, NeedRow, OfferRow, ExtractedResource } from "./types";

/**
 * Server-only database access. The service-role key bypasses RLS, and RLS on
 * every bc_ table has no policies, so nothing here is reachable with the anon
 * key. This module must never be imported from a client component.
 */
let cached: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export function dbEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── churches ────────────────────────────────────────────────────────────────

export async function getChurchByHost(host: string): Promise<ChurchRow | null> {
  const { data, error } = await db().from("bc_churches").select("*").eq("host", host).maybeSingle();
  if (error) throw error;
  return (data as ChurchRow) ?? null;
}

export async function getChurchBySlug(slug: string): Promise<ChurchRow | null> {
  const { data, error } = await db().from("bc_churches").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as ChurchRow) ?? null;
}

export async function getChurchesBySlugs(slugs: string[]): Promise<ChurchRow[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await db().from("bc_churches").select("*").in("slug", slugs);
  if (error) throw error;
  return (data as ChurchRow[]) ?? [];
}

export async function upsertChurch(row: Partial<ChurchRow> & { slug: string; name: string }): Promise<ChurchRow> {
  const { data, error } = await db()
    .from("bc_churches")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "slug" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChurchRow;
}

export async function replaceResources(churchId: string, resources: ExtractedResource[]): Promise<ResourceRow[]> {
  const client = db();
  const del = await client.from("bc_resources").delete().eq("church_id", churchId);
  if (del.error) throw del.error;
  if (resources.length === 0) return [];
  const rows = resources.map((r) => ({
    church_id: churchId,
    title: r.title,
    category: r.category,
    description: r.description,
    audience: r.audience,
    schedule: r.schedule,
    how_to_access: r.howToAccess,
    contact: r.contact,
    source_url: r.sourceUrl,
    confidence: r.confidence,
  }));
  const { data, error } = await client.from("bc_resources").insert(rows).select("*");
  if (error) throw error;
  return data as ResourceRow[];
}

export async function resourcesForChurch(churchId: string): Promise<ResourceRow[]> {
  const { data, error } = await db().from("bc_resources").select("*").eq("church_id", churchId).order("category");
  if (error) throw error;
  return (data as ResourceRow[]) ?? [];
}

export async function resourcesForChurches(churchIds: string[]): Promise<ResourceRow[]> {
  if (churchIds.length === 0) return [];
  const { data, error } = await db().from("bc_resources").select("*").in("church_id", churchIds);
  if (error) throw error;
  return (data as ResourceRow[]) ?? [];
}

/** Scanned churches inside a lat/lng bounding box. Caller refines by distance. */
export async function churchesInBox(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<ChurchRow[]> {
  const { data, error } = await db()
    .from("bc_churches")
    .select("*")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .limit(400);
  if (error) throw error;
  return (data as ChurchRow[]) ?? [];
}

export async function recentChurches(limit = 60): Promise<ChurchRow[]> {
  const { data, error } = await db()
    .from("bc_churches")
    .select("*")
    .eq("status", "scanned")
    .order("scanned_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ChurchRow[]) ?? [];
}

export async function countScanned(): Promise<{ churches: number; resources: number }> {
  const c = await db().from("bc_churches").select("id", { count: "exact", head: true }).eq("status", "scanned");
  const r = await db().from("bc_resources").select("id", { count: "exact", head: true });
  return { churches: c.count ?? 0, resources: r.count ?? 0 };
}

// ── needs & offers ──────────────────────────────────────────────────────────

export async function listNeeds(limit = 100): Promise<NeedRow[]> {
  const { data, error } = await db().from("bc_needs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as NeedRow[]) ?? [];
}

export async function createNeed(row: Omit<NeedRow, "id" | "created_at" | "status">): Promise<NeedRow> {
  const { data, error } = await db().from("bc_needs").insert(row).select("*").single();
  if (error) throw error;
  return data as NeedRow;
}

export async function listOffers(limit = 100): Promise<OfferRow[]> {
  const { data, error } = await db().from("bc_offers").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as OfferRow[]) ?? [];
}

export async function offersInBox(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<OfferRow[]> {
  const { data, error } = await db()
    .from("bc_offers")
    .select("*")
    .eq("status", "open")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .limit(200);
  if (error) throw error;
  return (data as OfferRow[]) ?? [];
}

export async function createOffer(row: Omit<OfferRow, "id" | "created_at" | "status">): Promise<OfferRow> {
  const { data, error } = await db().from("bc_offers").insert(row).select("*").single();
  if (error) throw error;
  return data as OfferRow;
}

// ── caches ──────────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const { data, error } = await db().from("bc_osm_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
  if (error || !data) return null;
  if (Date.now() - new Date(data.fetched_at).getTime() > maxAgeMs) return null;
  return data.payload as T;
}

export async function cacheSet(key: string, payload: unknown): Promise<void> {
  await db().from("bc_osm_cache").upsert({ key, payload, fetched_at: new Date().toISOString() });
}

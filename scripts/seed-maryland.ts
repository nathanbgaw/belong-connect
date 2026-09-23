/**
 * Seed the directory with real Maryland churches.
 *
 * For each population centre: resolve the zip, ask OpenStreetMap for
 * Christian places of worship within a few miles, keep the ones that publish
 * a website, and run them through the same scan pipeline the app uses.
 * Nothing here is invented: if OSM has no website for a church, it is not
 * scanned; if a site can't be read, it is stored as "unreadable".
 *
 *   npm run seed:maryland -- --per-zip 8 --limit 160 --concurrency 4
 */
import { lookupZip } from "../src/lib/geo";
import { osmChurchesNear } from "../src/lib/osm";
import { scanChurch, ScanError } from "../src/lib/scan";
import { getChurchByHost } from "../src/lib/db";
import { normalizeHost } from "../src/lib/geo";

const ZIPS = [
  "21201", "21204", "21222", "21228", "21117", "21061", "21146", "21113", "21401", "21044",
  "20910", "20850", "20878", "20874", "21701", "21014", "20715", "20774", "20601", "20707",
  "21740", "21801", "21157", "20740", "20782", "20735", "20653", "21601", "21921", "21001",
  "20678", "21221",
];

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
}
const PER_ZIP = arg("per-zip", 8);
const LIMIT = arg("limit", 160);
const CONCURRENCY = arg("concurrency", 4);
const RADIUS = 6;

(async () => {
  const t0 = Date.now();
  const queue: { url: string; hint: { lat: number; lng: number; name: string; address: string | null; phone: string | null } }[] = [];
  const seen = new Set<string>();

  for (const zip of ZIPS) {
    const place = await lookupZip(zip);
    if (!place) { console.log(`?? ${zip}: no place`); continue; }
    let churches;
    try {
      churches = await osmChurchesNear(place.lat, place.lng, RADIUS);
    } catch (e) {
      console.log(`!! ${zip} ${place.city}: ${(e as Error).message}`);
      continue;
    }
    const withSites = churches.filter((c) => c.website);
    let added = 0;
    for (const c of withSites) {
      const host = normalizeHost(c.website!);
      if (!host || seen.has(host)) continue;
      seen.add(host);
      queue.push({ url: c.website!, hint: { lat: c.lat, lng: c.lng, name: c.name, address: c.address, phone: c.phone } });
      added++;
      if (added >= PER_ZIP) break;
    }
    console.log(`${zip} ${place.city}: ${churches.length} churches, ${withSites.length} with sites, queued ${added}`);
    await new Promise((r) => setTimeout(r, 1500)); // be polite to Overpass
  }

  const todo = queue.slice(0, LIMIT);
  console.log(`\n${todo.length} churches to scan (${queue.length} candidates)\n`);

  let ok = 0, cached = 0, unreadable = 0, failed = 0, resourcesTotal = 0;
  let i = 0;
  async function worker() {
    while (i < todo.length) {
      const item = todo[i++];
      const host = normalizeHost(item.url)!;
      const existing = await getChurchByHost(host).catch(() => null);
      if (existing?.status === "scanned") { cached++; console.log(`  = ${host} (already scanned)`); continue; }
      if (existing?.status === "unreadable") { unreadable++; console.log(`  - ${host} (known unreadable)`); continue; }
      try {
        const r = await scanChurch(item.url, { hint: item.hint });
        ok++; resourcesTotal += r.resources.length;
        console.log(`  + ${r.church.name} — ${r.resources.length} resources (${host})`);
      } catch (e) {
        if (e instanceof ScanError) { unreadable++; console.log(`  - ${host}: ${e.message}`); }
        else { failed++; console.log(`  ! ${host}: ${(e as Error).message}`); }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\ndone in ${((Date.now() - t0) / 60000).toFixed(1)} min — scanned ${ok}, already had ${cached}, unreadable ${unreadable}, failed ${failed}, resources ${resourcesTotal}`);
})();

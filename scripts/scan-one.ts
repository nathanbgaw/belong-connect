import { scanChurch } from "../src/lib/scan";

const url = process.argv[2];
if (!url) {
  console.error("usage: npm run scan -- <church website>");
  process.exit(1);
}
const t0 = Date.now();
scanChurch(url, { force: process.argv.includes("--force"), onStatus: (s) => console.log("  ·", s) })
  .then(({ church, resources, cached }) => {
    console.log(`\n${church.name} (${church.slug}) — ${cached ? "cached" : "fresh"} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`${church.address ?? "no address"} · ${church.city ?? ""} ${church.zip ?? ""} · ${church.lat?.toFixed(3)},${church.lng?.toFixed(3)}`);
    console.log(`phone ${church.phone ?? "—"} · email ${church.email ?? "—"} · ${church.denomination ?? "—"}`);
    console.log(`\n${church.summary}\n`);
    for (const r of resources) {
      console.log(`- [${r.category}] ${r.title} (${r.confidence})`);
      console.log(`    ${r.description}`);
      if (r.schedule) console.log(`    when: ${r.schedule}`);
      if (r.how_to_access) console.log(`    access: ${r.how_to_access}`);
      if (r.contact) console.log(`    contact: ${r.contact}`);
      if (r.source_url) console.log(`    from: ${r.source_url}`);
    }
    console.log(`\npages read: ${church.pages_read.length}`);
    church.pages_read.forEach((p) => console.log("  ", p));
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });

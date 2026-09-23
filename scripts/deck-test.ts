import fs from "node:fs";
import { getChurchBySlug, resourcesForChurch } from "../src/lib/db";
import { deckForChurch } from "../src/lib/deck";
import { deckToPptx } from "../src/lib/pptx";
import { deckToPdf } from "../src/lib/pdf";

(async () => {
  const slug = process.argv[2] ?? "bay-area-community-church";
  const church = await getChurchBySlug(slug);
  if (!church) throw new Error("no church " + slug);
  const resources = await resourcesForChurch(church.id);
  const deck = deckForChurch(church, resources);
  const out = process.argv[3] ?? ".";
  fs.writeFileSync(`${out}/${deck.fileStem}.pptx`, await deckToPptx(deck));
  fs.writeFileSync(`${out}/${deck.fileStem}.pdf`, await deckToPdf(deck));
  console.log("slides:", deck.slides.length, deck.slides.map((s) => s.kind).join(","));
})().catch((e) => { console.error(e); process.exit(1); });

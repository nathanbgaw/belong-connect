import { labelFor } from "./categories";
import type { ChurchRow, ResourceRow, NearbyChurch } from "./types";

/**
 * The deck model. Both renderers (PPTX, PDF) draw from this, and both tools
 * build one: a church profile deck from a scan, or a "who's near you" deck
 * from a chat. Keeping the model separate from the renderers means Canva,
 * PowerPoint and PDF always say exactly the same thing.
 */

export interface DeckResource {
  title: string;
  category: string;
  description: string;
  schedule?: string | null;
  access?: string | null;
  contact?: string | null;
  source?: string | null;
  confidence?: string;
}

export interface DeckChurch {
  name: string;
  distance?: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  highlights: string[];
}

export type Slide =
  | { kind: "cover"; title: string; subtitle: string; meta: string[] }
  | { kind: "text"; heading: string; body: string[]; note?: string }
  | { kind: "resources"; heading: string; items: DeckResource[]; note?: string }
  | { kind: "churches"; heading: string; items: DeckChurch[]; note?: string }
  | { kind: "contact"; heading: string; lines: string[]; website?: string | null; note?: string };

export interface Deck {
  title: string;
  fileStem: string;
  slides: Slide[];
}

const DISCLAIMER =
  "Drafted automatically from the church's public website. Confirm hours and availability with the church before sending anyone.";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fmtDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function deckForChurch(church: ChurchRow, resources: ResourceRow[]): Deck {
  const slides: Slide[] = [];
  const place = [church.city, church.state].filter(Boolean).join(", ");
  slides.push({
    kind: "cover",
    title: church.name,
    subtitle: "What this church offers its community",
    meta: [place, church.denomination ?? "", `Read from ${church.host ?? church.website ?? "the church website"} · ${fmtDate(church.scanned_at)}`].filter(Boolean),
  });

  slides.push({
    kind: "text",
    heading: "At a glance",
    body: [
      church.summary ?? "",
      church.service_times ? `Services: ${church.service_times}` : "",
      church.tags.length ? `Offers something in: ${church.tags.map(labelFor).join(" · ")}` : "No public-facing resources were described on the pages we read.",
    ].filter(Boolean),
    note: `${church.pages_read.length} page${church.pages_read.length === 1 ? "" : "s"} read`,
  });

  const byCat = new Map<string, ResourceRow[]>();
  for (const r of resources) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
  const ordered = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length).flatMap(([, rs]) => rs);

  const pages = chunk(ordered, 3);
  pages.forEach((items, i) => {
    slides.push({
      kind: "resources",
      heading: pages.length > 1 ? `Resources (${i + 1} of ${pages.length})` : "Resources",
      items: items.map((r) => ({
        title: r.title,
        category: labelFor(r.category),
        description: r.description ?? "",
        schedule: r.schedule,
        access: r.how_to_access,
        contact: r.contact,
        source: r.source_url,
        confidence: r.confidence,
      })),
      note: i === pages.length - 1 ? DISCLAIMER : undefined,
    });
  });

  if (church.profile?.ministries?.length) {
    slides.push({
      kind: "text",
      heading: "Ministries mentioned",
      body: church.profile.ministries.slice(0, 14),
      note: "Named on the site, whether or not they are open to the public.",
    });
  }

  slides.push({
    kind: "contact",
    heading: "How to reach them",
    lines: [church.address ?? "", church.phone ? `Phone: ${church.phone}` : "", church.email ? `Email: ${church.email}` : ""].filter(Boolean),
    website: church.website,
    note: DISCLAIMER,
  });

  return { title: `${church.name} — Community Resources`, fileStem: church.slug, slides };
}

export function deckForNearby(opts: {
  need: string;
  placeLabel: string;
  churches: { church: NearbyChurch; resources: ResourceRow[] }[];
  unscannedWithSites: NearbyChurch[];
  noSite: NearbyChurch[];
}): Deck {
  const slides: Slide[] = [];
  slides.push({
    kind: "cover",
    title: `Churches that may help near ${opts.placeLabel}`,
    subtitle: opts.need,
    meta: [`${opts.churches.length} churches with resources found online`, `Prepared ${fmtDate()}`],
  });

  const cards: DeckChurch[] = opts.churches.map(({ church, resources }) => ({
    name: church.name,
    distance: `${church.distanceMiles.toFixed(1)} mi`,
    address: church.address,
    phone: church.phone,
    website: church.website,
    highlights: resources.slice(0, 4).map((r) => `${r.title}${r.schedule ? ` — ${r.schedule}` : ""}`),
  }));
  chunk(cards, 2).forEach((items, i, all) => {
    slides.push({ kind: "churches", heading: all.length > 1 ? `Nearby churches (${i + 1} of ${all.length})` : "Nearby churches", items });
  });

  for (const { church, resources } of opts.churches) {
    if (resources.length === 0) continue;
    chunk(resources, 3).forEach((items, i, all) => {
      slides.push({
        kind: "resources",
        heading: `${church.name}${all.length > 1 ? ` (${i + 1}/${all.length})` : ""}`,
        items: items.map((r) => ({
          title: r.title,
          category: labelFor(r.category),
          description: r.description ?? "",
          schedule: r.schedule,
          access: r.how_to_access,
          contact: r.contact,
          source: r.source_url,
          confidence: r.confidence,
        })),
      });
    });
  }

  const others = [
    ...opts.unscannedWithSites.slice(0, 8).map((c) => `${c.name} (${c.distanceMiles.toFixed(1)} mi) — ${c.website}`),
    ...opts.noSite.slice(0, 8).map((c) => `${c.name} (${c.distanceMiles.toFixed(1)} mi)${c.phone ? ` — ${c.phone}` : ""} — no website listed`),
  ];
  if (others.length) {
    slides.push({
      kind: "text",
      heading: "Also nearby, not yet read",
      body: others,
      note: "Worth a phone call. Churches without a website often run a pantry or closet that never makes it online.",
    });
  }

  slides.push({
    kind: "text",
    heading: "Before you go",
    body: [
      "Call ahead. Hours and availability change, and a website is rarely the first thing a church updates.",
      "Ask for the person named on the resource, or the church office.",
      "If a door is closed, the next church on this list is usually a few minutes away.",
    ],
    note: DISCLAIMER,
  });

  return { title: `Churches near ${opts.placeLabel}`, fileStem: `churches-near-${opts.placeLabel.replace(/\W+/g, "-").toLowerCase()}`, slides };
}

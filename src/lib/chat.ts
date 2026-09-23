import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./ai";
import { CATEGORIES, labelFor } from "./categories";
import { createNeed, offersInBox, resourcesForChurches } from "./db";
import { boundingBox, haversineMiles, lookupZip, normalizeHost } from "./geo";
import { nearbyChurches } from "./osm";
import { scanChurch, ScanError } from "./scan";
import type { NearbyChurch, ResourceRow } from "./types";

/**
 * The needs chat. A manual tool loop (no beta dependency, streamed text) with
 * six tools that do real work: resolve a zip, find churches around it, read
 * their websites on the fly, pull the resources we've stored, look at what
 * churches have offered on the board, and — only with consent — post the need.
 *
 * Everything the model can say about a church traces back to a tool result;
 * the system prompt forbids inventing programs or phone numbers.
 */

export const SYSTEM_PROMPT = `You are the guide for Belong Connect, a free directory of help offered by churches and ministries in Maryland, run for Project Belong Maryland (a nonprofit that mobilizes churches around foster, kinship and struggling families).

Your job: understand what the person needs, find real nearby help, and tell them plainly how to reach it.

How to work:
1. Read the need. If it's already clear, don't interrogate — one short clarifying question at most, and only if it changes where you'd send them.
2. You need a zip code to search. If they haven't given one, ask for it (just the zip is fine). Do not search without one.
3. Once you have a zip: call find_nearby_churches. Then, if there are nearby churches whose websites haven't been read yet, call scan_churches on up to 6 of the closest ones that have websites (prefer ones whose names or denominations suggest community ministry, but don't overthink it — reading is cheap). Then call get_church_resources for every scanned church that's near enough to matter, and search_offers for anything churches have posted directly.
4. Answer with the specific churches and specific resources that fit — name, what it is, when, how to access, the phone/contact IF a tool result gave one, and distance. Lead with the best 2–4 fits. Mention "inferred" items as "looks like they may have…, worth a call." If nothing fits exactly, say so honestly and give the nearest adjacent help (a benevolence fund when they asked about rent; a church office to call when nothing is listed) plus churches nearby with no website, since those often run pantries that never make it online.
5. Always suggest calling ahead; hours change and a website is the last thing a church updates.
6. Offer, once, to post their need (anonymously) to the board so churches can see it — call post_need only after they clearly say yes. Never post without consent, never store their name unless they give it and ask to be contacted.

Rules:
- Never invent a program, hour, address, phone number or person. If a tool result doesn't contain it, you don't know it.
- Warm, plain, short. This may be a person having a bad week on a phone at 11pm. No lists longer than they need, no jargon, no preaching.
- Don't ask for personal details beyond the need and the zip.
- Use markdown lightly: bold church names, short bullets. No headers.
- If asked about something outside Maryland, do your best with the same tools — they work anywhere in the US — but say the directory is built for Maryland.`;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "lookup_zip",
    description: "Resolve a US zip code to a city, state and coordinates. Use to confirm where the person is.",
    input_schema: { type: "object", properties: { zip: { type: "string" } }, required: ["zip"] },
  },
  {
    name: "find_nearby_churches",
    description:
      "Find churches near a zip code, combining our scanned directory with OpenStreetMap. Returns each church's distance, whether its website has been read, how many resources we have, and its tags. Radius in miles (default 8, max 25).",
    input_schema: {
      type: "object",
      properties: { zip: { type: "string" }, radius_miles: { type: "number" } },
      required: ["zip"],
    },
  },
  {
    name: "scan_churches",
    description:
      "Read the public websites of up to 6 churches right now and extract what they offer the community. Pass the exact 'website' values from find_nearby_churches. Slow (10–30s); results are cached for a month, so already-scanned churches return instantly.",
    input_schema: {
      type: "object",
      properties: { websites: { type: "array", items: { type: "string" }, maxItems: 6 } },
      required: ["websites"],
    },
  },
  {
    name: "get_church_resources",
    description: "Return the full resource list for scanned churches, by the 'key' values from find_nearby_churches or scan_churches.",
    input_schema: { type: "object", properties: { keys: { type: "array", items: { type: "string" } } }, required: ["keys"] },
  },
  {
    name: "search_offers",
    description: "Things churches have posted directly on the Belong Connect board that they can provide, near a zip.",
    input_schema: { type: "object", properties: { zip: { type: "string" }, radius_miles: { type: "number" } }, required: ["zip"] },
  },
  {
    name: "post_need",
    description: "Post the person's need to the public board (anonymous unless they ask to be contacted). ONLY call after they clearly agree.",
    input_schema: {
      type: "object",
      properties: {
        zip: { type: "string" },
        category: { type: "string", enum: [...CATEGORIES] },
        description: { type: "string", description: "The need in their words, with any names removed" },
        contact_ok: { type: "boolean" },
        contact: { type: "string", description: "Phone or email, only if they asked to be contacted" },
      },
      required: ["zip", "category", "description", "contact_ok"],
    },
  },
];

export interface ChatContext {
  status: (text: string) => void;
  /** Churches touched this turn, keyed by host, for the UI's cards and deck. */
  touched: Map<string, NearbyChurch>;
  place: { zip: string; city: string; state: string; lat: number; lng: number } | null;
}

function summarizeNearby(c: NearbyChurch, resourceCount?: number) {
  return {
    key: c.key,
    slug: c.scanned?.slug ?? null,
    name: c.name,
    distance_miles: Number(c.distanceMiles.toFixed(1)),
    website: c.website,
    scanned: c.scanned?.status === "scanned",
    unreadable: c.scanned?.status === "unreadable",
    resource_count: resourceCount ?? null,
    tags: c.scanned?.tags?.map(labelFor) ?? [],
    denomination: c.denomination,
    phone: c.phone,
    address: c.address,
  };
}

function summarizeResource(r: ResourceRow) {
  return {
    title: r.title,
    category: labelFor(r.category),
    description: r.description,
    schedule: r.schedule,
    how_to_access: r.how_to_access,
    contact: r.contact,
    confidence: r.confidence,
    source: r.source_url,
  };
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ChatContext): Promise<unknown> {
  switch (name) {
    case "lookup_zip": {
      ctx.status(`Looking up ${input.zip}…`);
      const place = await lookupZip(String(input.zip));
      if (!place) return { error: "That zip code didn't resolve. Ask them to check it." };
      ctx.place = place;
      return place;
    }
    case "find_nearby_churches": {
      const place = await lookupZip(String(input.zip));
      if (!place) return { error: "That zip code didn't resolve." };
      ctx.place = place;
      const radius = Math.min(25, Math.max(2, Number(input.radius_miles ?? 8)));
      ctx.status(`Finding churches within ${radius} miles of ${place.city}…`);
      const list = await nearbyChurches(place.lat, place.lng, radius);
      const scanned = list.filter((c) => c.scanned?.status === "scanned");
      const counts = new Map<string, number>();
      if (scanned.length) {
        const rs = await resourcesForChurches(scanned.map((c) => c.scanned!.id));
        for (const r of rs) counts.set(r.church_id, (counts.get(r.church_id) ?? 0) + 1);
      }
      for (const c of list) ctx.touched.set(c.key, c);
      const withSites = list.filter((c) => c.website && c.scanned?.status !== "scanned");
      const noSite = list.filter((c) => !c.website);
      ctx.status(`${list.length} churches nearby · ${scanned.length} already read · ${withSites.length} with websites not yet read`);
      return {
        place,
        radius_miles: radius,
        counts: { total: list.length, scanned: scanned.length, unread_with_website: withSites.length, no_website: noSite.length },
        churches: list.slice(0, 40).map((c) => summarizeNearby(c, c.scanned ? counts.get(c.scanned.id) ?? 0 : undefined)),
      };
    }
    case "scan_churches": {
      const websites = (Array.isArray(input.websites) ? input.websites : []).map(String).slice(0, 6);
      const results = await Promise.all(
        websites.map(async (w) => {
          const host = normalizeHost(w) ?? w;
          const hint = [...ctx.touched.values()].find((c) => c.host === host);
          try {
            const r = await scanChurch(w, {
              onStatus: (t) => ctx.status(t),
              hint: hint ? { lat: hint.lat, lng: hint.lng, name: hint.name, address: hint.address, phone: hint.phone } : undefined,
            });
            const touched = ctx.touched.get(host) ?? ctx.touched.get(hint?.key ?? "");
            const distance = ctx.place && r.church.lat != null && r.church.lng != null
              ? haversineMiles(ctx.place.lat, ctx.place.lng, r.church.lat, r.church.lng)
              : touched?.distanceMiles ?? 0;
            ctx.touched.set(host, {
              key: host,
              name: r.church.name,
              website: r.church.website,
              host,
              lat: r.church.lat ?? touched?.lat ?? 0,
              lng: r.church.lng ?? touched?.lng ?? 0,
              distanceMiles: distance,
              address: r.church.address,
              phone: r.church.phone,
              denomination: r.church.denomination,
              scanned: r.church,
            });
            return {
              key: host,
              name: r.church.name,
              status: "scanned",
              cached: r.cached,
              distance_miles: Number(distance.toFixed(1)),
              phone: r.church.phone,
              address: r.church.address,
              summary: r.church.summary,
              resources: r.resources.map(summarizeResource),
            };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "failed";
            ctx.status(`Couldn't read ${host} — ${e instanceof ScanError ? "site not readable" : "error"}`);
            return { key: host, status: e instanceof ScanError ? "unreadable" : "error", error: msg, phone: hint?.phone ?? null, address: hint?.address ?? null };
          }
        })
      );
      return { results };
    }
    case "get_church_resources": {
      const keys = (Array.isArray(input.keys) ? input.keys : []).map(String);
      const churches = keys.map((k) => ctx.touched.get(k)).filter((c): c is NearbyChurch => Boolean(c?.scanned));
      const rs = await resourcesForChurches(churches.map((c) => c.scanned!.id));
      ctx.status(`Pulling resources for ${churches.length} church${churches.length === 1 ? "" : "es"}…`);
      return {
        churches: churches.map((c) => ({
          key: c.key,
          name: c.name,
          distance_miles: Number(c.distanceMiles.toFixed(1)),
          phone: c.phone,
          address: c.address,
          website: c.website,
          summary: c.scanned!.summary,
          resources: rs.filter((r) => r.church_id === c.scanned!.id).map(summarizeResource),
        })),
      };
    }
    case "search_offers": {
      const place = await lookupZip(String(input.zip));
      if (!place) return { error: "That zip code didn't resolve." };
      const radius = Math.min(25, Math.max(2, Number(input.radius_miles ?? 10)));
      ctx.status("Checking what churches have posted on the board…");
      const offers = await offersInBox(boundingBox(place.lat, place.lng, radius));
      return {
        offers: offers
          .map((o) => ({
            church: o.church_name,
            website: o.website,
            category: labelFor(o.category),
            description: o.description,
            distance_miles: o.lat != null && o.lng != null ? Number(haversineMiles(place.lat, place.lng, o.lat, o.lng).toFixed(1)) : null,
            contact_name: o.contact_name,
            has_contact_email: Boolean(o.contact_email),
          }))
          .filter((o) => o.distance_miles == null || o.distance_miles <= radius),
      };
    }
    case "post_need": {
      const place = await lookupZip(String(input.zip));
      ctx.status("Posting the need to the board…");
      const need = await createNeed({
        zip: place?.zip ?? null,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        category: (CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : "other",
        description: String(input.description).slice(0, 2000),
        contact_ok: Boolean(input.contact_ok),
        contact: input.contact_ok && input.contact ? String(input.contact).slice(0, 200) : null,
      });
      return { ok: true, id: need.id, posted_at: need.created_at };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export interface ChatTurnResult {
  text: string;
  history: Anthropic.MessageParam[];
  churches: ReturnType<typeof summarizeNearby>[];
  place: ChatContext["place"];
}

const MAX_ITERATIONS = 10;

export async function runChatTurn(
  history: Anthropic.MessageParam[],
  userMessage: string,
  handlers: { status: (text: string) => void; delta: (text: string) => void }
): Promise<ChatTurnResult> {
  const client = anthropic();
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: userMessage }];
  const ctx: ChatContext = { status: handlers.status, touched: new Map(), place: null };
  let finalText = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
      output_config: { effort: "medium" },
    });
    let turnText = "";
    stream.on("text", (delta) => {
      turnText += delta;
      handlers.delta(delta);
    });
    const message = await stream.finalMessage();
    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "refusal") {
      finalText = turnText || "I can't help with that one, but I'm glad to help find food, clothing, counseling or other support nearby.";
      break;
    }
    if (message.stop_reason !== "tool_use") {
      finalText = turnText;
      break;
    }
    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (t) => {
        try {
          const out = await runTool(t.name, (t.input ?? {}) as Record<string, unknown>, ctx);
          return { type: "tool_result" as const, tool_use_id: t.id, content: JSON.stringify(out) };
        } catch (e) {
          return { type: "tool_result" as const, tool_use_id: t.id, content: JSON.stringify({ error: e instanceof Error ? e.message : "failed" }), is_error: true };
        }
      })
    );
    messages.push({ role: "user", content: results });
  }

  const scannedNearby = [...ctx.touched.values()]
    .filter((c) => c.scanned?.status === "scanned")
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 12);
  const counts = new Map<string, number>();
  for (const r of await resourcesForChurches(scannedNearby.map((c) => c.scanned!.id)).catch(() => [] as ResourceRow[])) {
    counts.set(r.church_id, (counts.get(r.church_id) ?? 0) + 1);
  }
  const churches = scannedNearby.map((c) => summarizeNearby(c, counts.get(c.scanned!.id) ?? 0));

  return { text: finalText, history: messages, churches, place: ctx.place };
}

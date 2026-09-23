/**
 * Multi-page crawl of a church website. Reads the homepage, picks the handful
 * of internal pages most likely to describe ministries, outreach and help
 * (by link text and path), and flattens everything to plain text for the
 * extractor. Sites that block readers or render entirely in the browser come
 * back empty — that is expected, and the caller says so honestly.
 */

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;
const PER_PAGE_CHARS = 7_000;
const TOTAL_CHARS = 48_000;
const DEFAULT_MAX_PAGES = 8;

const HONEST_UA = "BelongConnectBot/0.1 (+reads public church pages for a resource directory demo)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const KEYWORDS: [RegExp, number][] = [
  [/ministr/i, 4],
  [/outreach|serve|serving|missions?|compassion|mercy|benevolen/i, 5],
  [/food|pantry|meal|grocer|clothing|closet|thrift/i, 6],
  [/help|assistance|resources?|care|support|needs?/i, 4],
  [/community|local|neighbo/i, 3],
  [/recovery|celebrate|counsel|grief|divorce|addiction/i, 4],
  [/foster|adopt|orphan|family|families|children|kids|youth|students?|seniors?|adults?/i, 3],
  [/esl|english|immigra|refugee|espanol|español/i, 3],
  [/groups?|connect|get-involved|involved|next-steps/i, 2],
  [/about|contact|staff|leadership|visit|times/i, 2],
  [/events?|calendar/i, 1],
];

const SKIP = /\.(pdf|jpe?g|png|gif|svg|webp|mp3|mp4|zip|ics)(\?|$)|mailto:|tel:|javascript:|#|\/(give|giving|donate|tithe|login|signin|sign-in|account|cart|privacy|terms|sermons?|podcast|watch|live|media|blog|news)\b/i;

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

export interface CrawlResult {
  ok: boolean;
  baseUrl: string;
  host: string;
  pages: CrawledPage[];
  error: string | null;
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (h.startsWith("[") || h.includes(":")) return true;
  return false;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|nav|dd|dt)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function titleOf(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? htmlToText(m[1]).slice(0, 120) : "";
}

async function fetchHtml(url: string, ua: string): Promise<{ status: number; html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.8",
      },
    });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("Page too large");
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { status: res.status, html, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

/** Honest UA first; a standard browser UA only if the site refuses bots outright. */
async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const first = await fetchHtml(url, HONEST_UA);
  if (first.status < 400) return first;
  if ([403, 406, 429, 503].includes(first.status)) {
    const second = await fetchHtml(url, BROWSER_UA);
    if (second.status < 400) return second;
    throw new Error(`HTTP ${second.status}`);
  }
  throw new Error(`HTTP ${first.status}`);
}

function extractLinks(html: string, base: URL): { url: URL; text: string }[] {
  const out: { url: URL; text: string }[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 600) {
    const href = m[1].trim();
    if (SKIP.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
      u.hash = "";
      u.search = "";
      out.push({ url: u, text: htmlToText(m[2]).slice(0, 80) });
    } catch {
      /* ignore bad hrefs */
    }
  }
  return out;
}

function scoreLink(u: URL, text: string): number {
  const hay = `${u.pathname} ${text}`;
  let score = 0;
  for (const [re, w] of KEYWORDS) if (re.test(hay)) score += w;
  const depth = u.pathname.split("/").filter(Boolean).length;
  score -= Math.max(0, depth - 2) * 1.5;
  if (u.pathname === "/" || u.pathname === "") score = -100;
  return score;
}

export async function crawlSite(
  input: string,
  opts: { maxPages?: number; onPage?: (url: string, ok: boolean) => void } = {}
): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  let base: URL;
  try {
    base = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return { ok: false, baseUrl: input, host: "", pages: [], error: "That doesn't look like a web address." };
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    return { ok: false, baseUrl: base.toString(), host: base.hostname, pages: [], error: "Only http and https addresses can be read." };
  }
  if (isBlockedHost(base.hostname)) {
    return { ok: false, baseUrl: base.toString(), host: base.hostname, pages: [], error: "That address can't be read from here." };
  }

  const host = base.hostname.toLowerCase().replace(/^www\./, "");
  const pages: CrawledPage[] = [];

  let home: { html: string; finalUrl: string };
  try {
    home = await fetchPage(base.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { ok: false, baseUrl: base.toString(), host, pages: [], error: `Couldn't read the homepage (${msg}).` };
  }
  const homeText = htmlToText(home.html);
  opts.onPage?.(home.finalUrl, homeText.length > 40);
  if (homeText.length > 40) pages.push({ url: home.finalUrl, title: titleOf(home.html) || host, text: homeText.slice(0, PER_PAGE_CHARS) });

  // Pick the internal pages most likely to describe help someone could use.
  const finalBase = new URL(home.finalUrl);
  // Dedupe on host-without-www + path so www/non-www and trailing-slash variants count once.
  const pageKey = (u: URL) => `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "").toLowerCase()}`;
  const seen = new Set<string>([pageKey(finalBase), pageKey(base)]);
  const candidates = extractLinks(home.html, finalBase)
    .map((l) => ({ ...l, score: scoreLink(l.url, l.text) }))
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const c of candidates) {
    const key = pageKey(c.url);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(c.url.toString());
    if (picked.length >= maxPages - 1) break;
  }

  const results = await Promise.allSettled(
    picked.map(async (u) => {
      const p = await fetchPage(u);
      const text = htmlToText(p.html);
      return { url: p.finalUrl, title: titleOf(p.html), text };
    })
  );
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.text.length > 80) {
      opts.onPage?.(picked[i], true);
      pages.push({ url: r.value.url, title: r.value.title, text: r.value.text.slice(0, PER_PAGE_CHARS) });
    } else {
      opts.onPage?.(picked[i], false);
    }
  });

  if (pages.length === 0) {
    return {
      ok: false,
      baseUrl: base.toString(),
      host,
      pages: [],
      error:
        "The site loaded but had no readable text — it probably renders entirely in the browser (a Church Center or app-style site). Nothing to extract from here.",
    };
  }

  // Keep the total inside the extractor's budget, homepage first.
  let budget = TOTAL_CHARS;
  const trimmed: CrawledPage[] = [];
  for (const p of pages) {
    if (budget <= 500) break;
    const text = p.text.slice(0, Math.min(p.text.length, budget));
    budget -= text.length;
    trimmed.push({ ...p, text });
  }

  return { ok: true, baseUrl: base.toString(), host, pages: trimmed, error: null };
}

export function pagesToPrompt(pages: CrawledPage[]): string {
  return pages.map((p) => `=== PAGE: ${p.url}\n=== TITLE: ${p.title}\n${p.text}`).join("\n\n");
}

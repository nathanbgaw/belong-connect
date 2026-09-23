# Belong Connect

An open-source demo for [Project Belong Maryland](https://projectbelongmaryland.org): two tools that read what
churches already publish and put it in front of the people who need it.

**Live demo:** see the Vercel URL in the repo's About box.

| | What it does | Who it's for |
|---|---|---|
| **Tool 1 · `/scan`** | Paste a church website. It reads the homepage plus the pages most likely to describe ministries and help, drafts an inventory of what the church offers its community, and hands you a deck — **PowerPoint, PDF, or straight into Canva**. | Project Belong staff, county directors, church leaders |
| **Tool 2 · `/chat`** | Say what you need in your own words. It asks for a zip, finds churches around you (OpenStreetMap + our directory), **reads their websites on the spot**, and tells you who to call. It can also build a deck of the churches it found. | Anyone — a kinship grandmother, a caseworker, a pastor |
| **The board · `/needs`, `/offers`** | People post needs (anonymous by default); churches post what they can provide. The chat searches the offers too. | The network |

Everything the app says about a church comes from that church's own website or OpenStreetMap, read moments
ago. Every extracted resource cites the page it came from and is marked `stated` or `inferred`. If a site
says nothing about help, the inventory says so rather than padding.

## How it works

```
 a URL (from a person, or from OpenStreetMap near a zip)
   → crawl     homepage + up to 7 internal pages chosen by link text
               (ministries, outreach, serve, food, care, groups, about, contact …)
   → extract   Claude (claude-opus-5, structured output, low effort) → ChurchProfile
               name · address · phone · email · summary · ministries · resources[]
   → geocode   zip → zippopotam.us, else address → Nominatim  (no API keys)
   → store     Supabase (bc_churches, bc_resources) · cached 30 days by host
   → deck      one Deck model → pptxgenjs (PPTX) · pdfkit (PDF) · Canva Connect import
```

The chat is a plain tool-use loop over the same pipeline. Its six tools: `lookup_zip`,
`find_nearby_churches`, `scan_churches` (up to six sites at once, cached), `get_church_resources`,
`search_offers`, and `post_need` (only after the person says yes). Progress streams to the browser as
server-sent events, so a person sees "Reading lotwfm.org…" instead of a spinner.

Church lookup is [Overpass](https://overpass-api.de) (`amenity=place_of_worship` + `religion=christian`)
— free, keyless, and honest about its gaps: many congregations are mapped without a website, and the
chat says so. Set `GOOGLE_PLACES_API_KEY` if you want to layer Google Places on top (not wired yet; the
seam is `src/lib/osm.ts`).

## Run it

```bash
npm install
cp .env.example .env.local     # fill in the values below
npm run db:migrate             # creates the bc_* tables in your Supabase project
npm run dev                    # http://localhost:3000
```

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Everything. |
| `SUPABASE_SERVICE_ROLE_KEY` | Everything. **Secret** — bypasses RLS. The `bc_*` tables have RLS enabled with no policies, so only the server can read them. |
| `POSTGRES_PASSWORD` | `db:migrate` and the seed script only. |
| `ANTHROPIC_API_KEY` | Extraction and chat. |
| `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` | Optional. One-click "Add to Canva". Create an integration in the [Canva developer portal](https://www.canva.com/developers/), scopes `design:content:write design:meta:read`, redirect URL `https://<host>/api/canva/callback`. Without it, the UI points at Canva's native PPTX import. |
| `BELONG_MODEL` | Optional. Defaults to `claude-opus-5`. |

### Seed it with real Maryland churches

```bash
npm run seed:maryland -- --per-zip 8 --limit 160 --concurrency 4
```

For each of 32 Maryland population centres it asks OpenStreetMap for churches within six miles, keeps
the ones that publish a website, and runs them through the scan pipeline. Roughly $0.20 of model usage
per church. Sites that can't be read are stored as `unreadable`, not skipped, so the chat can still say
"here's the phone number; the website didn't load."

```bash
npm run scan -- https://some-church.org     # scan one site from the terminal
```

## Deploy

```bash
vercel --prod
```

Route handlers set `maxDuration = 300`; the chat and scan routes stream, so a slow church site doesn't
time out the request. Works on the Vercel Hobby plan with Fluid compute.

## Design principles (inherited from Belong Highway)

1. **Zero added work for churches.** We read the website they already maintain. Nobody is asked to fill in
   a profile or keep a second system current.
2. **Nothing invented.** The extractor is told a short honest list beats a padded one; every item cites its
   page; source URLs that weren't actually crawled are dropped.
3. **Relational, not transactional.** The answer to a need is a named person at a nearby church and a
   reason to call — not an order to fulfil. The chat always says "call first."
4. **Honest about gaps.** Unreadable sites, churches with no website, inferred items: all surfaced, none
   hidden.

## What's real and what isn't

Church names, addresses, phone numbers, websites and resources are real, read from public sources at
scan time. None of it has been confirmed by the churches named, and hours change. This is a demo of a
process, not a vetted directory. Needs posted to the board are stored as typed.

## Layout

```
src/lib/crawl.ts     multi-page crawler (SSRF-guarded, honest UA, browser UA only on 403)
src/lib/extract.ts   Claude structured extraction → ChurchProfile
src/lib/scan.ts      crawl → extract → geocode → store, cached by host
src/lib/osm.ts       Overpass lookup + merge with our directory
src/lib/chat.ts      the tool loop and its six tools
src/lib/deck.ts      the Deck model (church deck, nearby-churches deck)
src/lib/pptx.ts      pptxgenjs renderer     src/lib/pdf.ts  pdfkit renderer
src/lib/canva.ts     Canva Connect OAuth (PKCE) + design import
src/app/api/*        scan (SSE), chat (SSE), churches, decks, needs, offers, canva
scripts/             migrate, seed-maryland, scan-one
supabase/migrations  schema
```

MIT licensed. Built with Next.js 16, Supabase, and the Anthropic SDK.

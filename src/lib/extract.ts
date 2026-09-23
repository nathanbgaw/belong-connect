import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { addUsage, anthropic, describeUsage, emptyUsage, MODEL_EXTRACT } from "./ai";
import { CATEGORIES } from "./categories";
import type { CrawledPage } from "./crawl";
import { pagesToPrompt } from "./crawl";
import type { ChurchProfile } from "./types";

const categoryEnum = z.enum(CATEGORIES);

const ResourceSchema = z.object({
  title: z.string().describe("Short name of the program or resource, e.g. 'Community Food Pantry'"),
  category: categoryEnum,
  description: z.string().describe("1–2 plain sentences on what it is and who it is for, in the church's own terms"),
  audience: z.string().nullable().describe("Who can use it, if stated — e.g. 'anyone in the community', 'members only', 'families with children'"),
  schedule: z.string().nullable().describe("When it happens, if stated — days, times, frequency"),
  howToAccess: z.string().nullable().describe("How a person would get it — walk in, call ahead, sign up online, ask at the office"),
  contact: z.string().nullable().describe("A named person, email or phone for this resource, ONLY if the page states it"),
  sourceUrl: z.string().nullable().describe("The PAGE url this came from, copied exactly from the '=== PAGE:' marker"),
  confidence: z.enum(["stated", "inferred"]).describe("'stated' if the page explicitly describes this program; 'inferred' if only a ministry name or passing mention suggests it"),
});

export const ProfileSchema = z.object({
  name: z.string().describe("The church's name as it presents itself"),
  denomination: z.string().nullable(),
  address: z.string().nullable().describe("Street address if stated"),
  city: z.string().nullable(),
  state: z.string().nullable().describe("Two-letter state code if determinable"),
  zip: z.string().nullable().describe("5-digit zip if stated anywhere"),
  phone: z.string().nullable(),
  email: z.string().nullable().describe("A general office/contact email if stated"),
  serviceTimes: z.string().nullable().describe("Worship service times in one line, if stated"),
  summary: z.string().describe("2–3 warm, factual sentences a neighbor could read: who this church is and how it shows up for the community"),
  ministries: z.array(z.string()).describe("Names of ministries/programs mentioned, whether or not they count as public resources"),
  resources: z.array(ResourceSchema).describe("Concrete things a person outside the congregation could access"),
  tags: z.array(categoryEnum).describe("Categories this church clearly offers something in"),
});

const SYSTEM = `You read a church's public website and produce a structured, honest inventory of the help it offers to people — especially people who are not members. A nonprofit (Project Belong Maryland) uses this to point foster, kinship and struggling families to real, reachable help, so:

- Extract only what the pages support. A short, true list beats a long, padded one. Never invent hours, contacts or programs.
- A "resource" is something a person could actually use or show up to: a food pantry, clothing closet, community meal, benevolence or utility assistance, counseling, recovery or grief groups, ESL classes, tutoring, childcare or parents' groups, youth programs, seniors' programs, foster/adoption ministry, transportation help, a clinic, a diaper bank, furniture ministry, job help, prayer or pastoral care that is open to the community.
- Worship services, sermons, giving, staff bios, and internal committees are NOT resources. Small groups and Bible studies are not resources unless they are explicitly support-oriented (grief, divorce, recovery, special needs, foster/adoptive parents).
- For each resource, say who it's for and how to access it if the page says so, and copy the page URL it came from. Mark confidence "stated" only when the page clearly describes the program; use "inferred" when a ministry name or a passing mention merely suggests it.
- Reduce named individuals to first name + last initial unless the page presents them as the public contact for that resource.
- Pull address, phone, email, service times and zip only if they appear on the pages.`;

export async function extractProfile(pages: CrawledPage[], website: string): Promise<ChurchProfile> {
  const client = anthropic();
  const response = await client.messages.parse({
    model: MODEL_EXTRACT,
    max_tokens: 12_000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Website: ${website}\n\n${pagesToPrompt(pages)}`,
      },
    ],
    output_config: { format: zodOutputFormat(ProfileSchema), effort: "low" },
  });
  const parsed = response.parsed_output;
  console.log(`[extract] ${website} — ${describeUsage(addUsage(emptyUsage(), response), MODEL_EXTRACT)}`);
  if (!parsed) throw new Error("The model did not return a usable profile for this site.");
  const pageUrls = new Set(pages.map((p) => p.url));
  return {
    ...parsed,
    website,
    resources: parsed.resources.map((r) => ({
      ...r,
      // Only keep source URLs that were actually in the crawl — no invented citations.
      sourceUrl: r.sourceUrl && pageUrls.has(r.sourceUrl) ? r.sourceUrl : r.sourceUrl && [...pageUrls].find((u) => u.startsWith(r.sourceUrl!)) ? r.sourceUrl : null,
    })),
    pagesRead: pages.map((p) => p.url),
  };
}

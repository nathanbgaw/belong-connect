import { Door } from "@/components/ui";
import { countScanned, dbEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stats = dbEnabled() ? await countScanned().catch(() => ({ churches: 0, resources: 0 })) : { churches: 0, resources: 0 };
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="max-w-3xl">
        <span className="eyebrow">Project Belong Maryland · open-source demo</span>
        <h1 className="mt-3 text-4xl sm:text-5xl">Churches already offer a lot of help. Most of it never makes it to the person who needs it.</h1>
        <p className="mt-5 text-lg text-muted">
          Belong Connect reads what churches already publish and turns it into something a caseworker, a pastor, or a
          family can actually use — a one-page inventory of a church, or a plain answer to “where can I get help near
          me?”
        </p>
        {stats.churches > 0 && (
          <p className="mt-4 text-sm text-muted">
            So far: <strong className="text-ink">{stats.churches.toLocaleString()}</strong> Maryland church websites read ·{" "}
            <strong className="text-ink">{stats.resources.toLocaleString()}</strong> community resources found.
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Door
          href="/scan"
          eyebrow="Tool 1 · for churches & staff"
          title="Read a church website"
          body="Paste any church's web address. We read the site, draft an inventory of what it offers the community, and hand you a slide deck — PowerPoint, PDF, or straight into Canva."
          cta="Try it with a URL"
        />
        <Door
          href="/chat"
          eyebrow="Tool 2 · for anyone who needs help"
          title="Find help near me"
          body="Say what you need in your own words. We ask for your zip, look up churches around you, read their websites on the spot, and tell you who to call."
          cta="Start a conversation"
        />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <Door href="/churches" eyebrow="Directory" title="Churches we've read" body="Every church we've scanned so far, with its resources and a downloadable deck." cta="Browse" />
        <Door href="/needs" eyebrow="The board · needs" title="Post a need" body="Anonymous by default. Churches and ministries can see what people nearby are asking for." cta="See the board" />
        <Door href="/offers" eyebrow="The board · offers" title="Offer what your church has" body="A pantry, a van, a counselor, a spare room. Tell people it exists." cta="Add an offer" />
      </div>

      <section className="mt-14 grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="text-lg">Zero work for churches</h3>
          <p className="mt-2 text-sm text-muted">We read the website a church already maintains. Nobody is asked to fill in a profile or keep a second system current.</p>
        </div>
        <div>
          <h3 className="text-lg">Nothing invented</h3>
          <p className="mt-2 text-sm text-muted">Every resource cites the page it came from and is marked “stated” or “inferred.” If a site says nothing about help, the inventory says so.</p>
        </div>
        <div>
          <h3 className="text-lg">Relational, not transactional</h3>
          <p className="mt-2 text-sm text-muted">The answer to a need is a named person at a nearby church and a reason to call them — not an order to fulfil.</p>
        </div>
      </section>
    </div>
  );
}

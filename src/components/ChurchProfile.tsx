import { labelFor } from "@/lib/categories";
import type { ChurchRow, ResourceRow } from "@/lib/types";

export default function ChurchProfile({ church, resources }: { church: ChurchRow; resources: ResourceRow[] }) {
  const byCat = new Map<string, ResourceRow[]>();
  for (const r of resources) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
  const groups = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="eyebrow">{church.denomination ?? "Church"}</span>
            <h1 className="mt-1 text-3xl">{church.name}</h1>
            <p className="mt-1 text-muted">
              {[church.address, [church.city, church.state, church.zip].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right text-sm text-muted">
            {church.phone && <div>{church.phone}</div>}
            {church.email && <div>{church.email}</div>}
            {church.website && (
              <a className="text-primary-deep underline" href={church.website} target="_blank" rel="noreferrer">
                {church.host}
              </a>
            )}
          </div>
        </div>
        {church.summary && <p className="mt-5 text-lg">{church.summary}</p>}
        {church.service_times && <p className="mt-2 text-sm text-muted">Services: {church.service_times}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {church.tags.map((t) => (
            <span key={t} className="pill pill-primary">{labelFor(t)}</span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-2xl">Resources</h2>
        <span className="text-sm text-muted">{resources.length} found across {church.pages_read.length} pages</span>
      </div>
      {resources.length === 0 && (
        <p className="panel mt-3 p-5 text-muted">
          The pages we read didn’t describe any community-facing programs. That doesn’t mean there aren’t any — it means
          they aren’t on the website. A phone call to the office is the next step.
        </p>
      )}
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {groups.flatMap(([cat, rs]) =>
          rs.map((r) => (
            <div key={r.id} className="panel p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">{labelFor(cat)}</span>
                {r.confidence === "inferred" && <span className="pill pill-gold">inferred — confirm</span>}
              </div>
              <h3 className="mt-1 text-lg">{r.title}</h3>
              {r.description && <p className="mt-1 text-sm">{r.description}</p>}
              <dl className="mt-3 space-y-1 text-sm">
                {r.audience && <div><dt className="inline font-semibold">Who: </dt><dd className="inline">{r.audience}</dd></div>}
                {r.schedule && <div><dt className="inline font-semibold">When: </dt><dd className="inline">{r.schedule}</dd></div>}
                {r.how_to_access && <div><dt className="inline font-semibold">How: </dt><dd className="inline">{r.how_to_access}</dd></div>}
                {r.contact && <div><dt className="inline font-semibold">Contact: </dt><dd className="inline">{r.contact}</dd></div>}
              </dl>
              {r.source_url && (
                <a className="mt-3 block truncate text-xs text-muted underline" href={r.source_url} target="_blank" rel="noreferrer">
                  from {r.source_url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {church.profile?.ministries?.length ? (
        <div className="mt-8">
          <h2 className="text-xl">Ministries mentioned</h2>
          <p className="text-sm text-muted">Named on the site, whether or not they’re open to the public.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {church.profile.ministries.map((m) => (
              <span key={m} className="pill">{m}</span>
            ))}
          </div>
        </div>
      ) : null}

      <details className="mt-8 text-sm text-muted">
        <summary className="cursor-pointer">Pages read ({church.pages_read.length})</summary>
        <ul className="mt-2 list-disc pl-5">
          {church.pages_read.map((p) => (
            <li key={p}><a className="underline" href={p} target="_blank" rel="noreferrer">{p}</a></li>
          ))}
        </ul>
      </details>
    </div>
  );
}

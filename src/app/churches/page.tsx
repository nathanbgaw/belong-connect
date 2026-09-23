import Link from "next/link";
import { labelFor } from "@/lib/categories";
import { recentChurches, resourcesForChurches } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Directory() {
  const churches = await recentChurches(300);
  const resources = await resourcesForChurches(churches.map((c) => c.id));
  const counts = new Map<string, number>();
  for (const r of resources) counts.set(r.church_id, (counts.get(r.church_id) ?? 0) + 1);
  const sorted = [...churches].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <span className="eyebrow">Directory</span>
      <h1 className="mt-1 text-3xl">Churches we’ve read</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {churches.length} church websites read so far, {resources.length} community resources found. Drafted automatically — every
        item cites its page, and none of it has been confirmed by the church. <Link href="/scan" className="underline">Add one by URL.</Link>
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => (
          <Link key={c.id} href={`/churches/${c.slug}`} className="panel flex flex-col gap-2 p-5 transition hover:shadow-[var(--shadow-e2)]">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg leading-tight">{c.name}</h2>
              <span className="pill pill-primary shrink-0">{counts.get(c.id) ?? 0}</span>
            </div>
            <p className="text-sm text-muted">{[c.city, c.state].filter(Boolean).join(", ")}{c.denomination ? ` · ${c.denomination}` : ""}</p>
            <div className="flex flex-wrap gap-1">
              {c.tags.slice(0, 5).map((t) => <span key={t} className="pill">{labelFor(t)}</span>)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

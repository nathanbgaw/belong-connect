"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ChurchProfile from "@/components/ChurchProfile";
import DeckButtons from "@/components/DeckButtons";
import { readSse } from "@/lib/sse-client";
import type { ChurchRow, ResourceRow } from "@/lib/types";

const EXAMPLES = ["bayareacc.org", "heritage-cc.org", "gracefellowship.church", "reccmd.org"];

export default function ScanClient() {
  const params = useSearchParams();
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ church: ChurchRow; resources: ResourceRow[]; cached: boolean } | null>(null);
  const started = useRef(false);

  async function run(target: string, force = false) {
    if (!target.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setLog([]);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: target, force }) });
      await readSse(res, (event, data) => {
        const d = data as { text?: string; error?: string; church?: ChurchRow; resources?: ResourceRow[]; cached?: boolean };
        if (event === "status" && d.text) setLog((l) => [...l, d.text!]);
        if (event === "done" && d.church) setResult({ church: d.church, resources: d.resources ?? [], cached: Boolean(d.cached) });
        if (event === "error") setError(d.error ?? "Something went wrong.");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const u = params.get("url");
    if (u && !started.current) {
      started.current = true;
      run(u, params.get("force") === "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <span className="eyebrow">Tool 1</span>
      <h1 className="mt-1 text-3xl">Read a church website</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Paste a church’s web address. We read the homepage and the pages most likely to describe ministries and help,
        draft an inventory of what the church offers its community, and build a deck you can download as PowerPoint or PDF.
      </p>

      <form
        className="card mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          run(url);
        }}
      >
        <input
          className="field flex-1"
          placeholder="e.g. hopechurchmd.org"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? "Reading…" : "Read this site"}
        </button>
        {result && !busy && (
          <button type="button" className="btn btn-quiet" onClick={() => run(url, true)}>
            Re-read
          </button>
        )}
      </form>
      <p className="mt-2 text-sm text-muted">
        Try:{" "}
        {EXAMPLES.map((e, i) => (
          <span key={e}>
            <button type="button" className="underline" onClick={() => { setUrl(e); run(e); }}>{e}</button>
            {i < EXAMPLES.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>

      {(busy || log.length > 0) && (
        <div className="panel mt-6 p-5">
          <ul className="space-y-1 text-sm">
            {log.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={i === log.length - 1 && busy ? "dot" : "inline-block h-2 w-2 rounded-full bg-ok"} />
                {l}
              </li>
            ))}
            {busy && log.length === 0 && <li className="flex items-center gap-2"><span className="dot" /> Starting…</li>}
          </ul>
        </div>
      )}

      {error && (
        <div className="panel mt-6 border border-primary-soft p-5">
          <p className="font-semibold text-primary-deep">Couldn’t read that one.</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <p className="mt-2 text-sm text-muted">
            Some church sites block automated readers or render entirely in the browser (Church Center sites do). The
            honest answer is a phone call — or try the church’s other domain if it has one.
          </p>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>
              {result.cached ? "Read recently — showing the stored inventory." : "Fresh read."}{" "}
              <Link href={`/churches/${result.church.slug}`} className="underline">Permanent page →</Link>
            </span>
          </div>
          <div className="mb-6"><DeckButtons slug={result.church.slug} name={result.church.name} /></div>
          <ChurchProfile church={result.church} resources={result.resources} />
        </div>
      )}
    </div>
  );
}

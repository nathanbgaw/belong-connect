"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { readSse } from "@/lib/sse-client";

interface Msg {
  role: "user" | "assistant";
  text: string;
  statuses?: string[];
  working?: boolean;
}
interface ChurchCard {
  key: string;
  name: string;
  distance_miles: number;
  website: string | null;
  resource_count: number | null;
  tags: string[];
  phone: string | null;
  address: string | null;
  slug?: string;
}

const STARTERS = [
  "I'm a kinship grandmother raising two grandkids in 21061 and we're short on groceries this month.",
  "My teenager needs winter clothes and I can't afford them right now. We're in Frederick, 21701.",
  "I just took a foster placement of a toddler in Columbia and have nothing — no crib, no diapers.",
  "I'm behind on my BGE bill and scared of a shutoff. Baltimore, 21222.",
  "Is there a grief support group near 20910? I lost my mom last month.",
];

export default function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi. Tell me what you need — in your own words is fine — and your zip code, and I'll look at churches around you and find who can actually help." },
  ]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [churches, setChurches] = useState<ChurchCard[]>([]);
  const [place, setPlace] = useState<{ zip: string; city: string; state: string } | null>(null);
  const [need, setNeed] = useState<string>("");
  const [deckBusy, setDeckBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    if (!need) setNeed(t);
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: t }, { role: "assistant", text: "", statuses: [], working: true }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t, history }) });
      await readSse(res, (event, data) => {
        const d = data as { text?: string; error?: string; history?: unknown[]; churches?: ChurchCard[]; place?: { zip: string; city: string; state: string } | null };
        setMessages((m) => {
          const last = { ...m[m.length - 1] };
          if (event === "status" && d.text) last.statuses = [...(last.statuses ?? []), d.text];
          if (event === "delta" && d.text) last.text = last.text + d.text;
          if (event === "done") {
            last.text = d.text ?? last.text;
            last.working = false;
          }
          if (event === "error") {
            last.text = last.text || `Sorry — ${d.error ?? "something went wrong"}.`;
            last.working = false;
          }
          return [...m.slice(0, -1), last];
        });
        if (event === "done") {
          if (d.history) setHistory(d.history);
          if (d.churches) setChurches((prev) => mergeChurches(prev, d.churches!));
          if (d.place) setPlace(d.place);
        }
      });
    } catch (e) {
      setMessages((m) => {
        const last = { ...m[m.length - 1], text: `Sorry — ${e instanceof Error ? e.message : "something went wrong"}.`, working: false };
        return [...m.slice(0, -1), last];
      });
    } finally {
      setBusy(false);
    }
  }

  async function downloadDeck(format: "pptx" | "pdf") {
    if (!place) return;
    setDeckBusy(true);
    try {
      const res = await fetch("/api/chat/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ need, zip: place.zip, slugs: churches.map((c) => c.slug).filter(Boolean), format }),
      });
      if (!res.ok) throw new Error("Deck failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `churches-near-${place.zip}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDeckBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <div className="flex min-h-[70vh] flex-col">
        <div>
          <span className="eyebrow">Tool 2</span>
          <h1 className="mt-1 text-3xl">Find help near me</h1>
          <p className="mt-1 text-sm text-muted">No account, nothing stored unless you ask us to post your need. Built for Maryland; works anywhere in the US.</p>
        </div>

        <div className="card mt-5 flex flex-1 flex-col p-4 sm:p-6">
          <div className="flex-1 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user" ? "max-w-[85%] rounded-[18px] bg-primary px-4 py-3 text-white" : "max-w-[92%] rounded-[18px] bg-faint px-4 py-3"}>
                  {m.statuses && m.statuses.length > 0 && (
                    <ul className="mb-2 space-y-0.5 text-xs text-muted">
                      {m.statuses.map((s, j) => (
                        <li key={j} className="flex items-center gap-2">
                          <span className={m.working && j === m.statuses!.length - 1 && !m.text ? "dot" : "inline-block h-1.5 w-1.5 rounded-full bg-ok"} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.text ? <Markdown text={m.text} /> : m.working ? <span className="dot" /> : null}
                </div>
              </div>
            ))}
            <div ref={bottom} />
          </div>

          {messages.length === 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-xs text-muted hover:bg-faint" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input className="field flex-1" placeholder="What do you need? Include your zip if you know it." value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} autoFocus />
            <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
              {busy ? "Working…" : "Send"}
            </button>
          </form>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="panel p-5">
          <h2 className="text-lg">Churches in this conversation</h2>
          {place && <p className="text-sm text-muted">Around {place.city}, {place.state} {place.zip}</p>}
          {churches.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Once we’ve read some websites near you, they’ll show up here with what we found.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {churches.map((c) => (
                <li key={c.key} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    {c.slug ? (
                      <Link href={`/churches/${c.slug}`} className="font-semibold underline">{c.name}</Link>
                    ) : (
                      <span className="font-semibold">{c.name}</span>
                    )}
                    <span className="shrink-0 text-muted">{c.distance_miles} mi</span>
                  </div>
                  <div className="text-muted">
                    {c.resource_count != null ? `${c.resource_count} resource${c.resource_count === 1 ? "" : "s"}` : "read"}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {churches.length > 0 && place && (
          <div className="panel p-5">
            <h2 className="text-lg">Take this with you</h2>
            <p className="mt-1 text-sm text-muted">A deck of these churches and what they offer, for a caseworker or a friend.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => downloadDeck("pptx")} disabled={deckBusy}>PowerPoint</button>
              <button className="btn btn-secondary" onClick={() => downloadDeck("pdf")} disabled={deckBusy}>PDF</button>
            </div>
          </div>
        )}
        <div className="panel p-5 text-sm text-muted">
          <p>Everything said about a church comes from its own website or OpenStreetMap, read moments ago. Hours change — call first.</p>
          <p className="mt-2">If it’s an emergency, call 911. Maryland’s 211 line (dial 2-1-1) covers all services, not just churches.</p>
        </div>
      </aside>
    </div>
  );
}

function mergeChurches(prev: ChurchCard[], next: ChurchCard[]): ChurchCard[] {
  const map = new Map(prev.map((c) => [c.key, c]));
  for (const c of next) map.set(c.key, { ...map.get(c.key), ...c });
  return [...map.values()].sort((a, b) => a.distance_miles - b.distance_miles);
}

"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, labelFor } from "@/lib/categories";

interface Offer { id: string; church_name: string; website: string | null; zip: string | null; category: string; description: string; contact_name: string | null; created_at: string; has_contact: boolean }

export default function OffersClient() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState({ church_name: "", website: "", zip: "", category: "food", description: "", contact_name: "", contact_email: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => fetch("/api/offers").then((r) => r.json()).then((j) => setOffers(j.offers ?? []));
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(j.error ?? "Couldn't post that.");
    setMsg("Thank you. It's on the board and the chat can find it.");
    setForm({ church_name: "", website: "", zip: "", category: "food", description: "", contact_name: "", contact_email: "" });
    load();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[380px_1fr]">
      <div>
        <span className="eyebrow">The board</span>
        <h1 className="mt-1 text-3xl">Offer what your church has</h1>
        <p className="mt-2 text-sm text-muted">A pantry, a van, a counselor, a spare room, a handyman team. If it exists, someone nearby needs it.</p>
        <form onSubmit={submit} className="card mt-4 space-y-3 p-5">
          <input className="field" placeholder="Church or ministry name" value={form.church_name} onChange={(e) => setForm({ ...form, church_name: e.target.value })} required />
          <input className="field" placeholder="Website (optional)" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <input className="field" placeholder="Zip code" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} inputMode="numeric" />
          <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{labelFor(c)}</option>)}
          </select>
          <textarea className="field min-h-28" placeholder="What can you provide, for whom, and how should someone ask?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="field" placeholder="Contact name (shown)" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <input className="field" placeholder="Contact email (kept private)" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} type="email" />
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Posting…" : "Add to the board"}</button>
          {msg && <p className="text-sm text-muted">{msg}</p>}
        </form>
      </div>
      <div>
        <h2 className="text-2xl">What churches are offering</h2>
        <p className="text-sm text-muted">{offers.length} posted directly by churches and ministries. The chat searches these too.</p>
        <ul className="mt-4 space-y-3">
          {offers.map((o) => (
            <li key={o.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{o.church_name}</span>
                <span className="pill pill-primary">{labelFor(o.category)}</span>
              </div>
              <p className="mt-2 text-sm">{o.description}</p>
              <p className="mt-2 text-xs text-muted">
                {o.zip ? `near ${o.zip} · ` : ""}{o.contact_name ? `ask for ${o.contact_name} · ` : ""}
                {o.website && <a className="underline" href={o.website} target="_blank" rel="noreferrer">{o.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>}
              </p>
            </li>
          ))}
          {offers.length === 0 && <li className="text-sm text-muted">Nothing posted yet.</li>}
        </ul>
      </div>
    </div>
  );
}

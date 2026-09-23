"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, labelFor } from "@/lib/categories";

interface Need { id: string; zip: string | null; category: string; description: string; created_at: string; has_contact: boolean; status: string }

export default function NeedsClient() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [form, setForm] = useState({ zip: "", category: "food", description: "", contact_ok: false, contact: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => fetch("/api/needs").then((r) => r.json()).then((j) => setNeeds(j.needs ?? []));
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/needs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(j.error ?? "Couldn't post that.");
    setMsg("Posted. Churches nearby can see it now.");
    setForm({ zip: "", category: "food", description: "", contact_ok: false, contact: "" });
    load();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[380px_1fr]">
      <div>
        <span className="eyebrow">The board</span>
        <h1 className="mt-1 text-3xl">Post a need</h1>
        <p className="mt-2 text-sm text-muted">Anonymous by default. Only add a way to reach you if you want a church to follow up.</p>
        <form onSubmit={submit} className="card mt-4 space-y-3 p-5">
          <input className="field" placeholder="Zip code" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} inputMode="numeric" />
          <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{labelFor(c)}</option>)}
          </select>
          <textarea className="field min-h-28" placeholder="What do you need? Leave names out." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.contact_ok} onChange={(e) => setForm({ ...form, contact_ok: e.target.checked })} />
            A church may contact me
          </label>
          {form.contact_ok && <input className="field" placeholder="Phone or email (kept private)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Posting…" : "Post anonymously"}</button>
          {msg && <p className="text-sm text-muted">{msg}</p>}
        </form>
      </div>
      <div>
        <h2 className="text-2xl">Open needs</h2>
        <p className="text-sm text-muted">{needs.length} posted. Contact details are never shown here.</p>
        <ul className="mt-4 space-y-3">
          {needs.map((n) => (
            <li key={n.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span className="pill pill-primary">{labelFor(n.category)}</span>
                <span>{n.zip ? `near ${n.zip} · ` : ""}{new Date(n.created_at).toLocaleDateString()}{n.has_contact ? " · open to contact" : ""}</span>
              </div>
              <p className="mt-2 text-sm">{n.description}</p>
            </li>
          ))}
          {needs.length === 0 && <li className="text-sm text-muted">Nothing posted yet.</li>}
        </ul>
      </div>
    </div>
  );
}

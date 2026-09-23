"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Download the deck as PowerPoint or PDF, or push it straight into Canva.
 * "Add to Canva" is live when the deployment has a Canva integration; until
 * then it explains the drag-and-drop path, which Canva supports natively.
 */
export default function DeckButtons({ slug, name }: { slug: string; name: string }) {
  const params = useSearchParams();
  const [canva, setCanva] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const connectHref = `/api/canva/auth?return=${encodeURIComponent(`/churches/${slug}`)}`;

  useEffect(() => {
    fetch("/api/canva/status").then((r) => r.json()).then(setCanva).catch(() => setCanva({ configured: false, connected: false }));
  }, []);

  const queryMsg =
    params.get("canva") === "connected"
      ? "Canva connected — click “Add to Canva” to import."
      : params.get("canva") === "error"
        ? `Canva said: ${params.get("msg") ?? "something went wrong"}`
        : null;
  const shown = msg ?? queryMsg;

  async function addToCanva() {
    if (!canva?.configured || !canva.connected) return;
    setBusy(true);
    setMsg("Building the deck and importing it into Canva…");
    try {
      const res = await fetch("/api/canva/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const json = await res.json();
      if (json.connect) {
        setCanva({ configured: true, connected: false });
        setMsg("Your Canva session expired — connect again.");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setEditUrl(json.editUrl);
      setMsg(`“${json.title}” is now in your Canva.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">Take it with you:</span>
        <a className="btn btn-primary" href={`/api/churches/${slug}/deck?format=pptx`} download>PowerPoint</a>
        <a className="btn btn-secondary" href={`/api/churches/${slug}/deck?format=pdf`} download>PDF</a>
        <a className="btn btn-quiet" href={`/api/churches/${slug}/deck?format=pdf&inline=1`} target="_blank" rel="noreferrer">Preview</a>
        {canva?.configured ? (
          canva.connected ? (
            <button className="btn btn-secondary" onClick={addToCanva} disabled={busy}>
              {busy ? "Importing…" : "Add to Canva"}
            </button>
          ) : (
            <a className="btn btn-secondary" href={connectHref}>Connect Canva</a>
          )
        ) : (
          <span className="text-sm text-muted">
            Canva: download the PowerPoint and drop it on{" "}
            <a className="underline" href="https://www.canva.com/import" target="_blank" rel="noreferrer">canva.com/import</a>
            {canva && !canva.configured ? " (one-click import needs a Canva integration on this deployment)" : ""}.
          </span>
        )}
      </div>
      {shown && (
        <p className="mt-3 text-sm text-muted">
          {shown}{" "}
          {editUrl && (
            <a className="font-semibold text-primary-deep underline" href={editUrl} target="_blank" rel="noreferrer">Open in Canva →</a>
          )}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">The deck for {name} is generated fresh from the inventory each time.</p>
    </div>
  );
}

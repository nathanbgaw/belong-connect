"use client";

/** Download the deck as PowerPoint or PDF, generated fresh from the inventory each time. */
export default function DeckButtons({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">Take it with you:</span>
        <a className="btn btn-primary" href={`/api/churches/${slug}/deck?format=pptx`} download>PowerPoint</a>
        <a className="btn btn-secondary" href={`/api/churches/${slug}/deck?format=pdf`} download>PDF</a>
        <a className="btn btn-quiet" href={`/api/churches/${slug}/deck?format=pdf&inline=1`} target="_blank" rel="noreferrer">Preview</a>
      </div>
      <p className="mt-2 text-xs text-muted">The deck for {name} is built from the inventory above. Both files open in PowerPoint, Keynote, Google Slides and Canva.</p>
    </div>
  );
}

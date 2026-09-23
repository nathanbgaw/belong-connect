import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChurchProfile from "@/components/ChurchProfile";
import DeckButtons from "@/components/DeckButtons";
import { getChurchBySlug, resourcesForChurch } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChurchPage({ params }: PageProps<"/churches/[slug]">) {
  const { slug } = await params;
  const church = await getChurchBySlug(slug);
  if (!church) notFound();
  const resources = await resourcesForChurch(church.id);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <Link href="/churches" className="underline">← Directory</Link>
        <span>
          Read {church.scanned_at ? new Date(church.scanned_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} ·{" "}
          <Link href={`/scan?url=${encodeURIComponent(church.website ?? "")}&force=1`} className="underline">re-read now</Link>
        </span>
      </div>
      {church.status !== "scanned" ? (
        <div className="card p-8">
          <h1 className="text-3xl">{church.name}</h1>
          <p className="mt-3 text-muted">{church.error ?? "This site couldn't be read."}</p>
          {church.phone && <p className="mt-2">Phone: {church.phone}</p>}
        </div>
      ) : (
        <>
          <div className="mb-6"><Suspense><DeckButtons slug={church.slug} name={church.name} /></Suspense></div>
          <ChurchProfile church={church} resources={resources} />
        </>
      )}
    </div>
  );
}

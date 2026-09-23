import Link from "next/link";
import type { ReactNode } from "react";

export function Door({ href, eyebrow, title, body, cta }: { href: string; eyebrow: string; title: string; body: string; cta: string }) {
  return (
    <Link href={href} className="card group flex flex-col gap-3 p-7 transition hover:shadow-[var(--shadow-e3)]">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="text-2xl">{title}</h2>
      <p className="text-muted">{body}</p>
      <span className="mt-auto font-semibold text-primary-deep group-hover:underline">{cta} →</span>
    </Link>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

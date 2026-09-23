export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted">
        <p>
          <strong className="text-ink">Belong Connect</strong> is an open-source demo built for{" "}
          <a className="underline" href="https://projectbelongmaryland.org" target="_blank" rel="noreferrer">
            Project Belong Maryland
          </a>
          . Church inventories are drafted automatically from public websites and OpenStreetMap; nothing here is
          confirmed by the churches named. Call before you go.
        </p>
        <p className="mt-2">
          Source on{" "}
          <a className="underline" href="https://github.com/nathanbgaw/belong-connect" target="_blank" rel="noreferrer">
            GitHub
          </a>
          . No accounts, no tracking; needs are posted anonymously.
        </p>
      </div>
    </footer>
  );
}

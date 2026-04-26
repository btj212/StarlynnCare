import Link from "next/link";

/** Compact inky footer for mobile shell (brief §3 `.m-foot`). */
export function MobileFooter({ lastRefreshed }: { lastRefreshed: string | null }) {
  const year = new Date().getFullYear();
  const refresh = lastRefreshed ?? "weekly";

  return (
    <footer className="m-foot">
      <div className="brand-line">
        Starlynn<em className="not-italic" style={{ color: "#EBDDB8" }}>Care</em>
      </div>
      <p className="stmt">
        Independent care facility publisher. We grade every licensed memory care facility in California against the
        state&apos;s own public inspection record.
      </p>
      <nav className="links" aria-label="Footer links">
        <Link href="/california">All facilities</Link>
        <Link href="/methodology">Methodology</Link>
        <Link href="/data">Dataset overview</Link>
        <Link href="/llms.txt">llms.txt ↗</Link>
        <Link href="/about">About</Link>
        <Link href="/methodology#corrections">Corrections</Link>
        <Link href="mailto:hello@starlynncare.com">Contact</Link>
        <Link href="/data">Data &amp; API</Link>
      </nav>
      <div className="meta">
        © {year} StarlynnCare, PBC · Data refreshed {refresh} · CDSS · CMS Care Compare
      </div>
    </footer>
  );
}

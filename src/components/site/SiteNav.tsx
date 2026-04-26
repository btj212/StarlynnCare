import Link from "next/link";

export function SiteNav() {
  return (
    <header className="border-b border-sc-border bg-warm-white/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-8 px-6 py-4 md:px-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-serif)] text-xl font-semibold tracking-tight text-navy md:text-2xl"
        >
          StarlynnCare
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-slate">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-sc-border bg-warm-white px-2.5 py-0.5 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            Alameda County, CA
          </span>
          <Link
            href="/#how-it-works"
            className="hidden transition-colors hover:text-teal md:inline"
          >
            How it works
          </Link>
          <Link
            href="/methodology"
            className="hidden transition-colors hover:text-teal md:inline"
          >
            Methodology
          </Link>
          <Link
            href="/about"
            className="hidden transition-colors hover:text-teal md:inline"
          >
            About
          </Link>
          <Link
            href="/california/alameda-county"
            className="inline-flex items-center rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-mid"
          >
            Browse facilities
          </Link>
        </nav>
      </div>
    </header>
  );
}

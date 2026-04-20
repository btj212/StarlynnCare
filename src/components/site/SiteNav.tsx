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
          <Link
            href="/california/alameda-county"
            className="hidden transition-colors hover:text-teal sm:inline"
          >
            Alameda County
          </Link>
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

import Link from "next/link";

export function SiteNav() {
  return (
    <header className="border-b border-sc-border bg-warm-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-8 px-6 py-5 md:px-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-serif)] text-xl font-semibold tracking-tight text-navy md:text-2xl"
        >
          StarlynnCare
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate">
          <Link href="/florida" className="transition-colors hover:text-teal">
            Florida
          </Link>
          <a
            href="#how-it-works"
            className="hidden transition-colors hover:text-teal sm:inline"
          >
            How it works
          </a>
        </nav>
      </div>
    </header>
  );
}

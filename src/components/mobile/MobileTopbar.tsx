import Link from "next/link";
import { ZipSearch } from "@/components/site/ZipSearch";

/**
 * Sticky mobile topbar: brand, compact nav, ZIP search (brief §3).
 * Uses `.m-topbar` from mobile-shell.css — only render inside `.m-app` on <md viewports.
 */
export function MobileTopbar() {
  return (
    <header className="m-topbar">
      <div className="m-topbar-row">
        <Link href="/" className="m-brand no-underline text-ink" aria-label="StarlynnCare home">
          <span className="mark" aria-hidden />
          <span>
            Starlynn<em className="not-italic" style={{ color: "var(--color-rust)" }}>Care</em>
          </span>
          <span className="ca">CA</span>
        </Link>

        <details className="relative group">
          <summary className="m-menu list-none cursor-pointer [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Open menu</span>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <line x1="2" y1="5" x2="14" y2="5" />
              <line x1="2" y1="11" x2="14" y2="11" />
            </svg>
          </summary>
          <nav
            className="absolute right-0 top-full z-50 mt-2 w-52 border border-paper-rule bg-paper py-2 text-[14px] shadow-none"
            aria-label="Mobile menu"
          >
            <Link href="/california" className="block px-4 py-3 text-ink-2 no-underline hover:bg-paper-2">
              All facilities
            </Link>
            <Link href="/data" className="block px-4 py-3 text-ink-2 no-underline hover:bg-paper-2">
              The Data
            </Link>
            <Link href="/methodology" className="block px-4 py-3 text-ink-2 no-underline hover:bg-paper-2">
              Methodology
            </Link>
            <Link href="/about" className="block px-4 py-3 text-ink-2 no-underline hover:bg-paper-2">
              About
            </Link>
          </nav>
        </details>
      </div>
      <ZipSearch variant="mobileShell" />
    </header>
  );
}

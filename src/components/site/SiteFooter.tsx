import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-footer-bg text-white">
      <div className="mx-auto max-w-[1120px] px-6 py-14 md:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-serif)] text-xl font-semibold">
              StarlynnCare
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/75">
              Primary-source inspection and deficiency data. No paid placement.
              No referral commissions.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <span className="font-medium text-white/90">Explore</span>
            <Link
              href="/california/alameda-county"
              className="text-white/75 hover:text-white"
            >
              Alameda County memory care
            </Link>
            <Link
              href="/california"
              className="text-white/75 hover:text-white"
            >
              California
            </Link>
            <Link href="/" className="text-white/75 hover:text-white">
              Home
            </Link>
          </div>
        </div>
        <p className="mt-12 border-t border-white/10 pt-8 text-xs text-white/50">
          © {year} StarlynnCare. Data citations appear on each facility page.
        </p>
      </div>
    </footer>
  );
}

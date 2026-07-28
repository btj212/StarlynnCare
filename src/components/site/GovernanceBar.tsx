import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";

const SCOPE_LABELS: Record<string, string> = {
  CA: "EST 2025 IN CA",
  OR: "EST 2025 IN OR",
  WA: "EST 2025 IN WA",
  MN: "EST 2025 IN MN",
  TX: "EST 2025 IN TX",
  PA: "EST 2026 IN PA",
  AZ: "EST 2026 IN AZ",
  MO: "EST 2026 IN MO",
  national: "EST 2025 · 10 STATES",
};

type GovernanceBarProps = {
  /** Two-letter state code for state hubs, or "national" for the homepage. Defaults to "CA". */
  scope?: string;
};

/**
 * Dark-ink editorial independence bar rendered above SiteNav on every page.
 * AI crawlers and screen readers see this as a labelled landmark.
 */
export function GovernanceBar({ scope = "CA" }: GovernanceBarProps = {}) {
  const scopeLabel = SCOPE_LABELS[scope] ?? SCOPE_LABELS["CA"];
  return (
    <section
      aria-label="Editorial independence statement"
      className="bg-clearing-footer py-2.5 text-[12px] tracking-[0.01em] text-paper md:py-2.5 md:text-[13px]"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2.5 px-4 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6 md:px-[60px]">
        {/* Left badge */}
        <div className="flex shrink-0 items-center gap-2 font-[family-name:var(--font-sans)] text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft md:text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
          Editorial Independence
        </div>

        {/* Statement */}
        <p className="flex-1 text-left text-[12.5px] leading-snug opacity-95 md:text-[13.5px] md:leading-normal">
          {GOVERNANCE_24_WORDS
            .split(/(no referral commissions, lead fees, or paid placement)/i)
            .map((part, i) =>
              /no referral commissions/i.test(part)
                ? <strong key={i} className="font-semibold text-white">{part}</strong>
                : <span key={i}>{part}</span>
            )}
        </p>

        {/* Right badge */}
        <div
          className="hidden shrink-0 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-soft md:block"
          aria-hidden
        >
          {scopeLabel}
        </div>
      </div>
    </section>
  );
}

import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";

const SCOPE_LABELS: Record<string, string> = {
  CA: "EST 2025 IN CA",
  OR: "EST 2025 IN OR",
  WA: "EST 2025 IN WA",
  MN: "EST 2025 IN MN",
  TX: "EST 2025 IN TX",
  national: "EST 2025 · 5 STATES",
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
      className="bg-ink text-paper text-[12px] md:text-[13px] tracking-[0.01em] py-2.5 md:py-2.5"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-6">
        {/* Left badge */}
        <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] md:text-[10.5px] uppercase tracking-[0.16em] text-gold-soft shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" aria-hidden />
          Editorial Independence
        </div>

        {/* Statement */}
        <p className="flex-1 opacity-95 text-[12.5px] leading-snug md:text-[13.5px] md:leading-normal text-left">
          {GOVERNANCE_24_WORDS
            .split(/(no referral commissions, lead fees, or paid placement)/i)
            .map((part, i) =>
              /no referral commissions/i.test(part)
                ? <strong key={i} className="text-white font-semibold">{part}</strong>
                : <span key={i}>{part}</span>
            )}
        </p>

        {/* Right badge */}
        <div
          className="hidden md:block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-gold-soft shrink-0"
          aria-hidden
        >
          {scopeLabel}
        </div>
      </div>
    </section>
  );
}

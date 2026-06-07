import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";

/** Verbatim governance + editorial independence label (brief §1, §3). */
export function MobileTrustBar() {
  return (
    <section className="m-trust" aria-label="Editorial independence statement">
      <div className="label">Editorial Independence</div>
      <p>
        {GOVERNANCE_24_WORDS.split(/(no referral commissions, lead fees, or paid placement)/i).map((part, i) =>
          /no referral commissions/i.test(part) ? (
            <strong key={i} className="text-white font-semibold">
              {part}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </p>
    </section>
  );
}

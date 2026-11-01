import type { PublicPartnerPanel } from "@/lib/partners/panel";
import { PartnerTourForm } from "@/components/facility/partner/PartnerTourForm";

export function PartnerCommunityPanel({ panel }: { panel: PublicPartnerPanel }) {
  return (
    <section className="border-y border-paper-rule bg-paper-2" aria-labelledby="partner-community">
      <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-teal">
          From the community
        </p>
        <h2
          id="partner-community"
          className="mt-2 font-[family-name:var(--font-display)] text-[clamp(28px,4vw,40px)] text-ink"
        >
          {panel.communityName}
        </h2>
        <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-ink-3">{panel.label}</p>
        <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-ink-3">
          This block does not change the grade, the rank, a citation, or this community’s place in any list.
        </p>

        {panel.photos.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {panel.photos.map((src) => (
              <li key={src} className="overflow-hidden border border-paper-rule bg-paper">
                {/* Community-supplied photos are remote URLs, not the site image set. */}
                <img src={src} alt={`Photo provided by ${panel.communityName}`} className="aspect-[4/3] w-full object-cover" />
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {panel.priceLabel ? (
            <div>
              <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4">Price range</dt>
              <dd className="mt-1 text-ink">{panel.priceLabel}</dd>
            </div>
          ) : null}
          {panel.openings ? (
            <div>
              <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4">Openings</dt>
              <dd className="mt-1 text-ink">{panel.openings}</dd>
            </div>
          ) : null}
          {panel.staffingDay ? (
            <div>
              <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4">Day staffing</dt>
              <dd className="mt-1 text-ink">{panel.staffingDay}</dd>
            </div>
          ) : null}
          {panel.staffingNight ? (
            <div>
              <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4">Night staffing</dt>
              <dd className="mt-1 text-ink">{panel.staffingNight}</dd>
            </div>
          ) : null}
        </dl>
        {panel.pricesFresh ? null : (
          <p className="mt-4 text-sm text-ink-3">Prices and openings are hidden until the community updates them.</p>
        )}
        {panel.description ? (
          <p className="mt-6 max-w-[68ch] whitespace-pre-wrap text-[16px] leading-[1.7] text-ink-2">{panel.description}</p>
        ) : null}

        <PartnerTourForm
          facilityId={panel.facilityId}
          communityName={panel.communityName}
          consentText={panel.consentText}
          consentVersion={panel.consentVersion}
        />
      </div>
    </section>
  );
}

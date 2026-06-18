import Link from "next/link";
import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { FacilitySubNavAnchors } from "@/components/facility/profile/FacilitySubNavAnchors";
import { OfferTriggerButton } from "@/components/facility/offer/FacilityOfferProvider";

export function FacilitySubNav({ profile }: { profile: FacilityProfile }) {
  const { facility, state, region, county, rulesCards, tourQuestions } = profile;

  const backHref = region
    ? `/${state.slug}/${region.slug}`
    : `/${state.slug}/${facility.city_slug}`;

  type Anchor = { href: string; label: string; show: boolean };
  const anchors: Anchor[] = [
    { href: "#snapshot", label: "Snapshot", show: true },
    { href: "#peer", label: "Peer rank", show: true },
    { href: "#record", label: "Record", show: true },
    { href: "#rules", label: "Rules", show: rulesCards.length > 0 },
    { href: "#tour", label: "Tour", show: tourQuestions.length >= 3 },
    { href: "#full-record", label: "Full record", show: true },
  ].filter((a) => a.show);

  // Mobile chip order leads with the hard facts (peer rank, record) and pushes
  // the photo/map Snapshot to the end — matching the mobile section reordering.
  const mobileAnchors: Anchor[] = [
    ...anchors.filter((a) => a.href !== "#snapshot"),
    ...anchors.filter((a) => a.href === "#snapshot"),
  ];

  return (
    <div className="fp-subnav sticky top-[52px] z-30 border-b border-paper-rule bg-paper/92 backdrop-blur-[20px]">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="flex items-center justify-between gap-4 py-3">
          {/* Breadcrumb */}
          <nav
            className="hidden items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] md:flex"
            aria-label="Page location"
          >
            <Link href={`/${state.slug}`} className="border-b border-rust pb-px text-ink hover:text-rust">
              {state.name}
            </Link>
            <span className="text-ink-4">/</span>
            <Link href={backHref} className="border-b border-rust pb-px text-ink hover:text-rust">
              {region?.name ?? county?.name ?? facility.city ?? state.name}
            </Link>
            <span className="text-ink-4">/</span>
            <span className="text-ink-3">{facility.name}</span>
          </nav>

          <FacilitySubNavAnchors anchors={anchors} />

          {/* Mobile "jump to facts" chips — horizontally scrollable, one tap to
              the peer rank / citation record a high-intent visitor came for.
              Right-edge fade signals scrollability instead of a hard text cut. */}
          <nav
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto md:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_90%,transparent)]"
            aria-label="On this page"
          >
            {mobileAnchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="shrink-0 whitespace-nowrap border border-paper-rule bg-paper px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-ink-2 active:bg-ink active:text-paper transition-colors"
              >
                {a.label}
              </a>
            ))}
          </nav>

          {/* Actions — offer CTA on all viewports (A/B test must be visible on mobile) */}
          <div className="flex shrink-0 items-center gap-2">
            <OfferTriggerButton size="compact" />
          </div>
        </div>
      </div>
    </div>
  );
}

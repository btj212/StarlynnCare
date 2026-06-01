import Link from "next/link";
import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { FacilitySubNavAnchors } from "@/components/facility/profile/FacilitySubNavAnchors";

const PHONE_RE = /(\d{3})(\d{3})(\d{4})/;
function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const m = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (!m) return raw;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

export function FacilitySubNav({ profile }: { profile: FacilityProfile }) {
  const { facility, state, region, county, rulesCards, tourQuestions, snapshot } = profile;
  const phone = formatPhone(facility.phone);

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

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {phone && (
              <a
                href={`tel:${facility.phone}`}
                className="inline-flex items-center gap-1.5 bg-ink px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-paper hover:bg-ink-2 transition-colors"
              >
                Call {phone} →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

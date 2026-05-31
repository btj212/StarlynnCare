"use client";

import { ProximityGroup, proximityItemProps } from "@/components/interaction/ProximityGroup";

type Anchor = { href: string; label: string };

export function FacilitySubNavAnchors({ anchors }: { anchors: Anchor[] }) {
  return (
    <ProximityGroup radius={90} intensity={0.08}>
      <nav
        className="hidden items-center gap-[22px] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] md:flex"
        aria-label="On this page"
      >
        {anchors.map((a) => (
          <a
            key={a.href}
            href={a.href}
            {...proximityItemProps("text-ink-3 hover:text-rust transition-colors")}
          >
            {a.label}
          </a>
        ))}
      </nav>
    </ProximityGroup>
  );
}

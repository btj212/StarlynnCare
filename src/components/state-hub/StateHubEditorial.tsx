import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHead } from "@/components/editorial/SectionHead";
import { getArticleThumbnail } from "@/lib/content/articleThumbnails";
import type { EditorialCard } from "@/lib/stateHubConfigs/types";

type Props = {
  sectionLabel?: string;
  sectionTitle: ReactNode;
  cards: EditorialCard[];
  year: number;
  stateName: string;
};

export function StateHubEditorial({ sectionLabel, sectionTitle, cards, year, stateName }: Props) {
  return (
    <section
      id="editorial"
      className="border-b border-clearing-footer"
      style={{ background: "var(--color-clearing-footer)", color: "var(--color-paper)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-[60px] md:py-20">
        <SectionHead invert label={sectionLabel} title={sectionTitle} />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((e, i) => {
            const thumb = i > 0 ? getArticleThumbnail(e.href) : null;
            const inner = (
              <div
                className={`flex flex-col gap-3.5 rounded-[18px] border border-white/10 bg-white/[0.04] p-5 pt-6 sm:p-6 ${e.live ? "opacity-100" : "opacity-70"}`}
              >
                {i === 0 && (
                  <div
                    className="relative mb-2 max-h-[320px] overflow-hidden rounded-[14px]"
                    style={{ aspectRatio: "4/3", background: "linear-gradient(135deg, #2a3a30 0%, #1A2620 100%)" }}
                  >
                    <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(196,146,59,0.06) 0 14px, transparent 14px 28px)" }} />
                    <div style={{ position: "absolute", left: 24, top: 24 }} className="font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
                      STARLYNN ANNUAL · {year}
                    </div>
                    <div
                      className="absolute right-4 bottom-4 font-[family-name:var(--font-display)] text-[28px] leading-none tracking-[-0.02em] text-right sm:right-6 sm:bottom-6 sm:text-[36px] md:right-8 md:bottom-8 md:text-[40px]"
                      style={{ color: "#EBDDB8" }}
                    >
                      <span>The State of<br />Memory Care<br /></span>
                      <em style={{ color: "#fff" }}>in {stateName}</em>
                    </div>
                  </div>
                )}
                {thumb && (
                  <div
                    className="relative mb-2 max-h-[220px] w-full overflow-hidden rounded-[14px] border border-white/10"
                    style={{ aspectRatio: "4/3", background: "rgba(255,255,255,0.06)" }}
                  >
                    <Image
                      src={thumb.src}
                      alt={thumb.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 400px"
                    />
                  </div>
                )}
                <span className="font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">{e.kind}</span>
                <h3
                  className={`m-0 font-[family-name:var(--font-display)] font-normal leading-[1.05] tracking-[-0.01em] text-paper ${
                    i === 0 ? "text-[clamp(1.5rem,4.5vw,2.625rem)]" : "text-[1.375rem] sm:text-[1.625rem]"
                  }`}
                >
                  {e.title}
                </h3>
                <p className="m-0 text-[14.5px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {e.desc}
                </p>
                <div className="mt-auto font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {e.meta} {e.live ? "· Read →" : ""}
                </div>
              </div>
            );
            return e.live && e.href ? (
              <Link
                key={e.href}
                href={e.href}
                className="min-w-0 no-underline transition-opacity hover:opacity-90"
              >
                {inner}
              </Link>
            ) : (
              <div key={e.href ?? `soon-${i}`} className="min-w-0" aria-label={`Coming soon: ${e.title}`}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

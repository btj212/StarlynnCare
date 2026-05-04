import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { EditorialCard } from "@/lib/stateHubConfig";

type Props = {
  sectionLabel: string;
  sectionTitle: ReactNode;
  cards: EditorialCard[];
  year: number;
};

export function StateHubEditorial({ sectionLabel, sectionTitle, cards, year }: Props) {
  return (
    <section
      id="editorial"
      className="border-b border-paper-rule"
      style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
        <SectionHead invert label={sectionLabel} title={sectionTitle} />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((e, i) => {
            const inner = (
              <div className={`flex flex-col gap-3.5 border-t pt-6 ${e.live ? "opacity-100" : "opacity-70"}`} style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                {i === 0 && (
                  <div
                    className="relative mb-2 max-h-[320px]"
                    style={{ aspectRatio: "4/3", background: "linear-gradient(135deg, #2a3a30 0%, #1A2620 100%)", overflow: "hidden" }}
                  >
                    <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(196,146,59,0.06) 0 14px, transparent 14px 28px)" }} />
                    <div style={{ position: "absolute", left: 24, top: 24 }} className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-gold">
                      STARLYNN ANNUAL · {year}
                    </div>
                    <div
                      className="absolute right-4 bottom-4 sm:right-6 sm:bottom-6 md:right-8 md:bottom-8 font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] md:text-[40px] leading-none tracking-[-0.02em] text-right"
                      style={{ color: "#EBDDB8" }}
                    >
                      <span>The State of<br />Memory Care<br /></span>
                      <em style={{ color: "#fff" }}>in California</em>
                    </div>
                  </div>
                )}
                <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-gold">{e.kind}</span>
                <h3
                  className={`font-[family-name:var(--font-display)] font-normal leading-[1.05] tracking-[-0.01em] m-0 text-paper ${
                    i === 0 ? "text-[clamp(1.5rem,4.5vw,2.625rem)]" : "text-[1.375rem] sm:text-[1.625rem]"
                  }`}
                >
                  {e.title}
                </h3>
                <p className="text-[14.5px] leading-[1.5] m-0" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {e.desc}
                </p>
                <div className="mt-auto font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {e.meta} {e.live ? "· Read →" : ""}
                </div>
              </div>
            );
            return e.live && e.href ? (
              <Link
                key={i}
                href={e.href}
                className="no-underline hover:opacity-90 transition-opacity min-w-0"
              >
                {inner}
              </Link>
            ) : (
              <div key={i} className="min-w-0" aria-label={`Coming soon: ${e.title}`}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

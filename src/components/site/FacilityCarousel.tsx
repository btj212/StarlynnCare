"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { CareCategory } from "@/lib/types";

const CATEGORY_LABEL: Partial<Record<CareCategory, string>> = {
  rcfe_memory_care: "RCFE · Memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory care",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home · Dementia SCU",
  ccrc: "CCRC",
};

export type CarouselFacility = {
  id: string;
  name: string;
  city: string | null;
  care_category: CareCategory;
  photo_url: string;
  slug: string;
  city_slug: string;
  state_slug: string;
  grade: string | null;
  composite: number | null;
  sev_pct: number | null;
  rep_pct: number | null;
  freq_pct: number | null;
};

function gradeColor(letter: string | null): string {
  if (!letter) return "#9a938a";
  if (letter.startsWith("A")) return "#6b8f71";
  if (letter.startsWith("B")) return "#c8a26b";
  if (letter.startsWith("C")) return "#c8a26b";
  return "#b5532e";
}

function gradeBg(letter: string | null): string {
  if (!letter) return "#f5f2ec";
  if (letter.startsWith("A")) return "#f0f5f1";
  if (letter.startsWith("B")) return "#fdf8f0";
  return "#fdf3f0";
}

function barColor(pct: number | null): string {
  if (pct === null) return "#9a938a";
  if (pct >= 65) return "#6b8f71";
  if (pct <= 35) return "#b5532e";
  return "#c8a26b";
}

const METRIC_BARS: [string, keyof Pick<CarouselFacility, "sev_pct" | "rep_pct" | "freq_pct">][] = [
  ["Severity", "sev_pct"],
  ["Repeats", "rep_pct"],
  ["Frequency", "freq_pct"],
];

const INTERVAL_MS = 4000;

export function FacilityCarousel({ facilities }: { facilities: CarouselFacility[] }) {
  const n = facilities.length;
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % n);
  }, [n]);

  useEffect(() => {
    const timer = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [advance]);

  const pct = `${(index / n) * 100}%`;
  const current = facilities[index];
  const href = `/${current.state_slug}/${current.city_slug}/${current.slug}`;

  return (
    <div className="rounded-2xl border border-sc-border bg-white shadow-card-hover overflow-hidden hero-enter-delay-2">
      {/* Slide track */}
      <div
        className="carousel-track"
        style={{ width: `${n * 100}%`, transform: `translateX(-${pct})` }}
      >
        {facilities.map((f, i) => (
          <div key={f.id} style={{ width: `${100 / n}%` }}>
            <Link
              href={`/${f.state_slug}/${f.city_slug}/${f.slug}`}
              className="block px-5 pt-5 pb-4 hover:bg-sc-border/5 transition-colors"
              tabIndex={i === index ? 0 : -1}
              aria-label={`View ${f.name} quality profile`}
            >
              <CardInner f={f} />
            </Link>
          </div>
        ))}
      </div>

      {/* Dots + link */}
      <div className="flex items-center justify-between px-5 pb-4 pt-3 border-t border-sc-border/50">
        <div className="flex gap-1.5 items-center">
          {facilities.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === index
                  ? "h-1.5 w-4 bg-teal"
                  : "h-1.5 w-1.5 bg-sc-border hover:bg-teal/40"
              }`}
              aria-label={`View ${facilities[i].name}`}
            />
          ))}
        </div>
        <Link
          href={href}
          className="text-xs font-semibold text-teal hover:underline underline-offset-2 shrink-0"
          tabIndex={0}
        >
          View full profile →
        </Link>
      </div>
    </div>
  );
}

function CardInner({ f }: { f: CarouselFacility }) {
  const color = gradeColor(f.grade);
  const bg = gradeBg(f.grade);
  const hasGrade = f.grade !== null;

  return (
    <>
      {/* Header: photo + name + category */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-sc-border/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.photo_url}
            alt={`Exterior of ${f.name}`}
            className="h-full w-full object-cover"
            loading="eager"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-serif)] text-base font-semibold leading-snug text-navy line-clamp-2">
              {f.name}
            </h3>
            <span className="shrink-0 inline-flex items-center rounded-full bg-teal-light px-2 py-0.5 text-[10px] font-semibold text-teal">
              {CATEGORY_LABEL[f.care_category] ?? "Care facility"}
            </span>
          </div>
          {f.city && (
            <p className="mt-0.5 text-xs text-muted">{f.city}, CA</p>
          )}
        </div>
      </div>

      {/* Grade + metric bars */}
      <div
        className="mt-3.5 flex items-stretch gap-4 rounded-xl px-4 py-3.5"
        style={{ backgroundColor: bg }}
      >
        {/* Grade letter */}
        <div className="flex flex-col items-center justify-center shrink-0 w-12">
          <span
            className="font-[family-name:var(--font-serif)] text-[2.5rem] font-semibold leading-none"
            style={{ color }}
          >
            {f.grade ?? "—"}
          </span>
          {f.composite !== null && (
            <span className="mt-1 text-[9px] font-medium text-center leading-tight" style={{ color: "#9a938a" }}>
              {f.composite}th
              <br />pct
            </span>
          )}
        </div>

        {/* Vertical divider */}
        <div className="w-px self-stretch rounded-full" style={{ backgroundColor: `${color}30` }} />

        {/* Metric bars */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5">
          {hasGrade ? (
            METRIC_BARS.map(([label, key]) => {
              const val = f[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted leading-none">{label}</span>
                    {val !== null && (
                      <span
                        className="text-[10px] font-semibold leading-none tabular-nums"
                        style={{ color: barColor(val) }}
                      >
                        {val}<span className="font-normal opacity-70">th</span>
                      </span>
                    )}
                  </div>
                  <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ backgroundColor: `${color}20` }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${val ?? 0}%`,
                        backgroundColor: barColor(val),
                      }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[11px] text-muted">No inspection data on file</p>
          )}
        </div>
      </div>
    </>
  );
}

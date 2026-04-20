"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { CareCategory } from "@/lib/types";
import type { BenchmarkTier } from "@/lib/benchmarks";

const CATEGORY_LABEL: Record<CareCategory, string> = {
  rcfe_memory_care: "RCFE · Memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory care",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home · Dementia SCU",
  ccrc: "CCRC",
  unknown: "Care facility",
};

const TIER_CFG: Record<
  BenchmarkTier,
  { label: string; badge: string; dot: string }
> = {
  strong: {
    label: "Strong",
    badge: "bg-teal-light text-teal border border-teal/20",
    dot: "bg-teal",
  },
  mixed: {
    label: "Mixed",
    badge: "bg-amber-light text-amber border border-amber/30",
    dot: "bg-amber",
  },
  concerns: {
    label: "Concerns",
    badge: "bg-red-light text-red-600 border border-red-200",
    dot: "bg-red-500",
  },
  informational: {
    label: "—",
    badge: "bg-sc-border/40 text-muted border border-sc-border",
    dot: "bg-muted",
  },
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
  // raw stats
  inspections: number;
  type_a: number;
  // benchmark tiers
  dpi: number;
  dpi_tier: BenchmarkTier;
  type_a_tier: BenchmarkTier;
  complaint_rate: number | null;
  complaint_tier: BenchmarkTier;
};

const INTERVAL_MS = 3000;

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

  return (
    <div className="rounded-2xl border border-sc-border bg-white shadow-card-hover overflow-hidden hero-enter-delay-2">
      {/* Slide track — all cards inline, move the track */}
      <div
        className="carousel-track"
        style={{
          width: `${n * 100}%`,
          transform: `translateX(-${pct})`,
        }}
      >
        {facilities.map((f) => (
          <div key={f.id} style={{ width: `${100 / n}%` }}>
            <CardInner f={f} />
          </div>
        ))}
      </div>

      {/* Dot indicators + link — outside the sliding track so they stay fixed */}
      <div className="flex items-center justify-between px-5 pb-4 pt-0 border-t border-sc-border/50">
        <div className="flex gap-1">
          {facilities.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-4 bg-teal"
                  : "w-1.5 bg-sc-border hover:bg-teal/40"
              }`}
              aria-label={`View ${facilities[i].name}`}
            />
          ))}
        </div>
        <Link
          href={`/${facilities[index].state_slug}/${facilities[index].city_slug}/${facilities[index].slug}`}
          className="text-xs font-semibold text-teal hover:underline underline-offset-2"
        >
          View full profile →
        </Link>
      </div>
    </div>
  );
}

function CardInner({ f }: { f: CarouselFacility }) {
  const cfg = TIER_CFG;
  const dpiDisplay =
    f.dpi > 0 ? `${f.dpi.toFixed(2)} per inspection` : "0 per inspection";
  const typeADisplay =
    f.type_a === 1 ? "1 Type A citation" : `${f.type_a} Type A citations`;
  const complaintDisplay =
    f.complaint_rate !== null
      ? `${Math.round(f.complaint_rate * 100)}% substantiated`
      : "No complaints on file";

  return (
    <div className="px-5 pt-5 pb-4">
      {/* Header: small square photo + name + badge */}
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
              {CATEGORY_LABEL[f.care_category]}
            </span>
          </div>
          {f.city && (
            <p className="mt-0.5 text-xs text-muted">{f.city}, CA</p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="my-3.5 border-t border-sc-border/60" />

      {/* AT A GLANCE rows */}
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
        At a glance
      </p>
      <div className="space-y-2.5">
        {/* Compliance */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate">
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg[f.dpi_tier].dot}`}
              aria-hidden
            />
            Compliance record
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-medium text-ink">{dpiDisplay}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg[f.dpi_tier].badge}`}
            >
              {cfg[f.dpi_tier].label}
            </span>
          </div>
        </div>

        {/* Severity */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate">
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg[f.type_a_tier].dot}`}
              aria-hidden
            />
            Severity record
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-medium text-ink">{typeADisplay}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg[f.type_a_tier].badge}`}
            >
              {cfg[f.type_a_tier].label}
            </span>
          </div>
        </div>

        {/* Complaints */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate">
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg[f.complaint_tier].dot}`}
              aria-hidden
            />
            Complaint pattern
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-medium text-ink">{complaintDisplay}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg[f.complaint_tier].badge}`}
            >
              {cfg[f.complaint_tier].label}
            </span>
          </div>
        </div>
      </div>

      {/* Spacer so dots row aligns consistently */}
      <div className="mt-4" />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { CareCategory } from "@/lib/types";

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

export type CarouselFacility = {
  id: string;
  name: string;
  city: string | null;
  street: string | null;
  care_category: CareCategory;
  photo_url: string;
  slug: string;
  city_slug: string;
  state_slug: string;
  inspections: number;
  type_a: number;
  type_b: number;
  recent_summary: string | null;
};

const INTERVAL_MS = 2800;
const FADE_MS = 280;

export function FacilityCarousel({ facilities }: { facilities: CarouselFacility[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const advance = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setIndex((i) => (i + 1) % facilities.length);
      setVisible(true);
    }, FADE_MS);
  }, [facilities.length]);

  useEffect(() => {
    const timer = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [advance]);

  const f = facilities[index];
  if (!f) return null;

  const hasTypeA = f.type_a > 0;
  const hasTypeB = !hasTypeA && f.type_b > 0;
  const href = `/${f.state_slug}/${f.city_slug}/${f.slug}`;

  return (
    <div
      className={`rounded-2xl border bg-white shadow-card-hover overflow-hidden card-lift hero-enter-delay-2 ${
        hasTypeA ? "border-red-200" : hasTypeB ? "border-orange-200" : "border-sc-border"
      }`}
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {/* Photo */}
      <div className="relative h-36 w-full overflow-hidden bg-sc-border/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={f.photo_url}
          alt={`Exterior of ${f.name}`}
          className="h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        {hasTypeA && (
          <span className="absolute top-2 left-2 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white shadow-sm">
            Type A on file
          </span>
        )}
        <span className="absolute bottom-1.5 right-2 text-[9px] text-white/60">
          © Google Street View
        </span>
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5 space-y-3">
        {/* Name + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-serif)] text-lg font-semibold leading-snug text-navy">
              {f.name}
            </p>
            {f.city && (
              <p className="mt-0.5 text-xs text-muted">
                {f.street ? `${f.street} · ` : ""}{f.city}, CA
              </p>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-teal-light px-2.5 py-0.5 text-[10px] font-semibold text-teal">
            {CATEGORY_LABEL[f.care_category]}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted">{f.inspections} inspections on file</span>
          {hasTypeA && (
            <span className="inline-flex items-center gap-1 font-semibold text-red-600">
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                Type A
              </span>
              {f.type_a}
            </span>
          )}
          {!hasTypeA && hasTypeB && (
            <span className="inline-flex items-center gap-1 font-medium text-orange-600">
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-orange-50 text-orange-600">
                Type B
              </span>
              {f.type_b}
            </span>
          )}
          {!hasTypeA && !hasTypeB && (
            <span className="font-medium text-teal">No citations on file</span>
          )}
        </div>

        {/* Most recent inspection summary */}
        {f.recent_summary && (
          <p className="text-xs text-slate leading-relaxed line-clamp-2">
            {f.recent_summary}
          </p>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-sc-border/50">
          {/* Dot indicators */}
          <div className="flex gap-1">
            {facilities.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setVisible(false);
                  setTimeout(() => { setIndex(i); setVisible(true); }, FADE_MS);
                }}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === index ? "w-4 bg-teal" : "w-1.5 bg-sc-border hover:bg-teal/40"
                }`}
                aria-label={`View ${facilities[i].name}`}
              />
            ))}
          </div>
          <Link
            href={href}
            className="text-xs font-semibold text-teal hover:underline underline-offset-2"
          >
            View full profile →
          </Link>
        </div>
      </div>
    </div>
  );
}

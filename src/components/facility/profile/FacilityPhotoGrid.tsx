"use client";

import { useEffect, useState } from "react";

/**
 * FacilityPhotoGrid — 2×2 photo grid for facility profiles.
 *
 * Shows when the facility has ≥4 photos in its gallery (Street View + Places).
 * Falls back to a single hero image when fewer photos exist.
 * Google attribution is rendered as subtle white/40 overlay text per ToS.
 */

type PhotoSource = {
  url: string;
  source: string;
  attribution: string;
};

type Props = {
  photoUrls: string[];
  photoSources: PhotoSource[];
  facilityName: string;
};

export function FacilityPhotoGrid({ photoUrls, photoSources, facilityName }: Props) {
  const hasGrid = photoUrls.length >= 4;

  if (!hasGrid) {
    const photo = photoUrls[0] ?? null;
    const attribution = photoSources[0]?.attribution ?? null;
    return (
      <SinglePhoto photo={photo} attribution={attribution} facilityName={facilityName} />
    );
  }

  const slots = photoUrls.slice(0, 4);

  // Build a single accurate attribution line:
  // - Always credit "© Google" (covers both Street View and Places)
  // - Append any unique photographer names from Places authorAttributions
  const photographerNames = Array.from(
    new Set(
      photoSources.slice(0, 4)
        .map((s) => s.attribution)
        .filter((a): a is string => Boolean(a) && a !== "© Google Street View" && a !== "Google Places" && a !== "© Google")
    )
  );
  const attributionLine = photographerNames.length > 0
    ? `© Google · ${photographerNames.join(", ")}`
    : "© Google";

  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
      <div className="grid grid-cols-2 gap-[2px] h-full">
          {slots.map((url, i) => (
          <OpenablePhoto
            key={`${url}-${i}`}
            url={url}
            alt={i === 0 ? facilityName : `${facilityName} — photo ${i + 1}`}
            facilityName={facilityName}
            attribution={attributionLine}
            eager={i === 0}
          />
        ))}
      </div>
      {/* Google attribution — required by ToS, readable but unobtrusive */}
      <div className="absolute bottom-1.5 right-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.06em] text-white/70 pointer-events-none select-none" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
        {attributionLine}
      </div>
    </div>
  );
}

function SinglePhoto({
  photo,
  attribution,
  facilityName,
}: {
  photo: string | null;
  attribution: string | null;
  facilityName: string;
}) {
  return (
    <div className="relative aspect-square overflow-hidden" style={{ background: "linear-gradient(135deg, #C9D8C8 0%, #8FA89A 60%, #6F8479 100%)" }}>
      {photo ? (
        <OpenablePhoto
          url={photo}
          alt={facilityName}
          facilityName={facilityName}
          attribution={attribution ?? ""}
          eager
          fill
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.22em] text-white/70">
          Photo
        </span>
      )}
      {attribution && (
        <div className="absolute bottom-1 right-1.5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.06em] text-white/70 pointer-events-none select-none" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {attribution === "© Google Street View" || attribution === "Google Places" ? "© Google" : attribution}
        </div>
      )}
    </div>
  );
}

function OpenablePhoto({
  url,
  alt,
  facilityName,
  attribution,
  eager,
  fill = false,
}: {
  url: string;
  alt: string;
  facilityName: string;
  attribution: string;
  eager: boolean;
  fill?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open a larger photo of ${facilityName}`}
        className={
          fill
            ? "absolute inset-0 cursor-zoom-in"
            : "relative h-full w-full cursor-zoom-in overflow-hidden bg-ink/20"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading={eager ? "eager" : "lazy"}
          width={fill ? 400 : 600}
          height={fill ? 400 : 400}
          decoding="async"
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo of ${facilityName}`}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="flex max-h-[90vh] max-w-[920px] flex-col items-center" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} className="max-h-[80vh] w-auto max-w-full object-contain" />
            <div className="mt-3 flex w-full items-center justify-between gap-4">
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-paper/80">{attribution}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.08em] text-paper"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
  // Collect unique attributions to display once at the bottom
  const attributions = Array.from(
    new Set(photoSources.slice(0, 4).map((s) => s.attribution).filter(Boolean))
  );

  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
      <div className="grid grid-cols-2 gap-[2px] h-full">
        {slots.map((url, i) => (
          <div key={i} className="relative overflow-hidden bg-ink/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={i === 0 ? facilityName : `${facilityName} — photo ${i + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
      {/* Subtle Google attribution — white/40 per ToS, bottom-right */}
      {attributions.length > 0 && (
        <div className="absolute bottom-1.5 right-2 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.06em] text-white/40 pointer-events-none select-none">
          {attributions.join(" · ")}
        </div>
      )}
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={facilityName}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.22em] text-white/70">
          Photo
        </span>
      )}
      {attribution && (
        <div className="absolute bottom-1 right-1.5 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.06em] text-white/40 pointer-events-none select-none">
          {attribution}
        </div>
      )}
    </div>
  );
}

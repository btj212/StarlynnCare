import { SectionHead } from "@/components/editorial/SectionHead";
import type { CaliforniaStateHubData } from "@/lib/data/stateHub";

type Props = {
  reviews: CaliforniaStateHubData["sampleReviews"];
};

export function StateHubReviews({ reviews }: Props) {
  if (reviews.length === 0) return null;

  return (
    <section className="border-b border-clearing-rule bg-clearing-bg">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-[60px] md:py-20">
        <SectionHead
          title={<>From people who have actually <em>moved a parent in.</em></>}
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="min-w-0 rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-5 py-7 shadow-[var(--shadow-card)] sm:px-7 sm:py-8"
            >
              <p
                className="m-0 mb-5 font-[family-name:var(--font-display)] text-[22px] leading-[1.3] tracking-[-0.005em] text-ink"
                style={{ position: "relative" }}
              >
                <span
                  aria-hidden
                  className="font-[family-name:var(--font-display)] text-[56px] leading-none text-teal"
                  style={{ verticalAlign: "-22px", marginRight: 4 }}
                >
                  &ldquo;
                </span>
                {r.body}
              </p>
              <div className="flex flex-col gap-1 border-t border-clearing-rule-3 pt-3.5 font-[family-name:var(--font-sans)] text-[13px] tracking-[0.02em] text-ink-3">
                <span className="text-[14px] tracking-[2px] text-gold">
                  {"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}
                </span>
                {r.reviewer_name && (
                  <span className="font-medium tracking-[0.02em] text-ink">{r.reviewer_name}</span>
                )}
                {r.facility_name && (
                  <span>{r.facility_name}{r.facility_city ? ` · ${r.facility_city}` : ""}</span>
                )}
                <span className="text-grade-a">
                  ✓ Identity verified · {new Date(r.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

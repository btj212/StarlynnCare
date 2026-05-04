import { SectionHead } from "@/components/editorial/SectionHead";
import type { CaliforniaStateHubData } from "@/lib/data/stateHub";

type Props = {
  reviews: CaliforniaStateHubData["sampleReviews"];
};

export function StateHubReviews({ reviews }: Props) {
  if (reviews.length === 0) return null;

  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
        <SectionHead
          label="§ 05 · Verified Family Experience"
          title={<>From people who have actually <em>moved a parent in.</em></>}
        />
        <div className="grid grid-cols-1 divide-y divide-paper-rule border-t-2 border-ink md:grid-cols-3 md:divide-x md:divide-y-0">
          {reviews.map((r) => (
            <div key={r.id} className="px-4 py-7 sm:px-7 sm:py-8 min-w-0">
              <p
                className="font-[family-name:var(--font-display)] text-[22px] leading-[1.3] tracking-[-0.005em] text-ink m-0 mb-5"
                style={{ position: "relative" }}
              >
                <span
                  aria-hidden
                  className="font-[family-name:var(--font-display)] text-[56px] leading-none text-rust"
                  style={{ verticalAlign: "-22px", marginRight: 4 }}
                >
                  &ldquo;
                </span>
                {r.body}
              </p>
              <div
                className="flex flex-col gap-1 border-t border-paper-rule pt-3.5 font-[family-name:var(--font-mono)] text-[11.5px] tracking-[0.06em] text-ink-3"
              >
                <span className="text-gold text-[14px] tracking-[2px]">
                  {"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}
                </span>
                {r.reviewer_name && (
                  <span className="text-ink font-medium tracking-[0.04em]">{r.reviewer_name}</span>
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

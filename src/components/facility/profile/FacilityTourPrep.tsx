import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";

export function FacilityTourPrep({ profile }: { profile: FacilityProfile }) {
  const { tourQuestions, facility } = profile;

  // Require at least 3 questions to render the section
  if (tourQuestions.length < 3) return null;

  const cards = tourQuestions.slice(0, 3);

  return (
    <section id="tour" className="scroll-mt-36 border-b border-clearing-rule py-16 md:scroll-mt-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px]">
        <SectionHead
          label="Tour Prep"
          title={
            <>
              Questions to ask <em>before you visit.</em>
            </>
          }
          deck={`A short pre-tour checklist tailored to ${facility.name}'s record and state requirements.`}
        />

        <div className="grid gap-3.5 md:grid-cols-3">
          {cards.map((q, i) => (
            <div
              key={i}
              className="rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-6 py-7 shadow-[var(--shadow-card)]"
            >
              <div className="mb-3 font-[family-name:var(--font-sans)] text-[12px] font-semibold tracking-[0.12em] text-teal">
                {String(i + 1).padStart(2, "0")} /
              </div>
              <h4 className="m-0 mb-2.5 font-[family-name:var(--font-display)] text-[22px] font-normal leading-[1.2] tracking-[-0.005em]">
                {q}
              </h4>
              <p className="text-[13.5px] leading-[1.5] text-ink-2">
                Ask the operator on tour. Take notes and compare answers across facilities you visit.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

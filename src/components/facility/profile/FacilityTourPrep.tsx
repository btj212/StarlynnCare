import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";

export function FacilityTourPrep({ profile }: { profile: FacilityProfile }) {
  const { tourQuestions, facility } = profile;

  // Require at least 3 questions to render the section
  if (tourQuestions.length < 3) return null;

  const cards = tourQuestions.slice(0, 3);

  return (
    <section id="tour" className="scroll-mt-28 border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="Tour Prep"
          title={
            <>
              Questions to ask <em>before you visit.</em>
            </>
          }
          deck={`A short pre-tour checklist tailored to ${facility.name}'s record and state requirements.`}
        />

        <div className="grid gap-1 bg-paper-rule md:grid-cols-3">
          {cards.map((q, i) => (
            <div key={i} className="bg-paper-2 px-6 py-7">
              <div className="mb-3 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] text-rust">
                {String(i + 1).padStart(2, "0")} /
              </div>
              <h4 className="font-[family-name:var(--font-display)] text-[22px] font-normal leading-[1.2] tracking-[-0.005em] m-0 mb-2.5">
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

import { SectionHead } from "@/components/editorial/SectionHead";
import type { FaqPair } from "@/lib/content/cityFaqs";

export function HubFaqSection({
  regionName,
  faqPairs,
}: {
  regionName: string;
  faqPairs: FaqPair[];
}) {
  if (faqPairs.length === 0) return null;

  return (
    <div className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
        <SectionHead
          label="§ Frequently asked"
          title={<>About memory care in <em>{regionName}.</em></>}
        />
        <div className="grid gap-8 md:grid-cols-2 max-w-[88ch]">
          {faqPairs.map((qa) => (
            <div key={qa.q}>
              <h3 className="font-[family-name:var(--font-display)] text-[19px] leading-[1.35] text-ink mb-2">
                {qa.q}
              </h3>
              <p className="text-[15px] leading-[1.65] text-ink-2 whitespace-pre-wrap">{qa.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { SectionHead } from "@/components/editorial/SectionHead";

export type FacilityFaqPair = { q: string; a: string };

function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/);
  return (
    <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
      {parts.map((part, index) =>
        part.startsWith("http") ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

export function FacilityFaq({ pairs }: { pairs: FacilityFaqPair[] }) {
  if (pairs.length === 0) return null;

  return (
    <section id="faq" className="scroll-mt-36 border-b border-clearing-rule py-16 md:scroll-mt-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px]">
        <SectionHead
          label="File"
          title={
            <>
              From this home&apos;s <em>file.</em>
            </>
          }
          deck="Counts and lines from the state file we hold."
        />
        <dl className="max-w-[72ch] divide-y divide-clearing-rule">
          {pairs.map((pair) => (
            <div key={pair.q} className="py-6 first:pt-0">
              <dt className="m-0 font-[family-name:var(--font-display)] text-[22px] font-normal leading-[1.2] tracking-[-0.005em] text-ink">
                {pair.q}
              </dt>
              <dd className="mt-3">
                <AnswerText text={pair.a} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

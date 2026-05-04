import { SectionHead } from "@/components/editorial/SectionHead";
import { HomeFaq } from "@/components/home/HomeFaq";
import type { FaqItem } from "@/lib/content/stateFaqs";

type Props = {
  faqs: FaqItem[];
};

export function StateHubFaq({ faqs }: Props) {
  return (
    <section
      id="faq"
      className="border-b border-paper-rule"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
        <SectionHead
          label="§ 06 · Common Questions"
          title={<>What families and clinicians <em>ask us first.</em></>}
        />
        <HomeFaq faqs={faqs} />
      </div>
    </section>
  );
}

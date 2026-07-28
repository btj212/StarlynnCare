import { SectionHead } from "@/components/editorial/SectionHead";
import { HomeFaq } from "@/components/home/HomeFaq";
import type { FaqItem } from "@/lib/content/stateFaqs";

type Props = {
  faqs: FaqItem[];
};

export function StateHubFaq({ faqs }: Props) {
  return (
    <section id="faq" className="border-b border-clearing-rule bg-clearing-bg">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-[60px] md:py-20">
        <SectionHead
          title={<>What families and clinicians <em>ask us first.</em></>}
        />
        <HomeFaq faqs={faqs} />
      </div>
    </section>
  );
}

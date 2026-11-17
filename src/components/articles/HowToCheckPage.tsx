import type { ReactNode } from "react";
import { FacilityLookupBox } from "@/components/articles/FacilityLookupBox";
import { GatedArticleFrame } from "@/components/articles/GatedArticleFrame";
import { HOW_TO_CHECK, type HowToState } from "@/lib/content/howToCheckArticles";

export function HowToCheckPage({ code, children }: { code: HowToState; children: ReactNode }) {
  const article = HOW_TO_CHECK[code];
  return (
    <GatedArticleFrame
      path={article.path}
      title={article.title}
      description={article.description}
      datePublished={article.datePublished}
      eyebrow={article.badge}
      heading={<>{article.headingLead} <em>{article.headingEm}</em></>}
      image={article.image}
      crumbs={[
        { name: "Home", path: "/" },
        { name: article.stateName, path: article.statePath },
        { name: article.title, path: article.path },
      ]}
      nav={{
        badge: article.badge,
        countStateCode: article.code,
        ctaHref: article.facilitiesPath,
        ctaLabel: `${article.stateName} memory care facilities`,
        stateNavHref: article.statePath,
      }}
      faq={article.faq}
    >
      <FacilityLookupBox
        stateSlug={article.statePath.slice(1)}
        stateName={article.stateName}
        regulatorName={article.regulatorName}
        regulatorUrl={article.regulatorUrl}
      />
      {children}
    </GatedArticleFrame>
  );
}

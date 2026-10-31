import type { ReactNode } from "react";
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
      heading={<>How to check a {article.stateName} memory care <em>inspection record</em></>}
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
      {children}
    </GatedArticleFrame>
  );
}

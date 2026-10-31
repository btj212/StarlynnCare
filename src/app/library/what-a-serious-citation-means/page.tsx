import type { Metadata } from "next";
import { GatedArticleFrame } from "@/components/articles/GatedArticleFrame";
import { SeriousCitationExplainer } from "@/components/articles/SeriousCitationExplainer";
import { metadataForGatedArticle } from "@/lib/content/articleReview";
import { SERIOUS_EXPLAINER } from "@/lib/content/seriousExplainer";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForGatedArticle({
    path: SERIOUS_EXPLAINER.path,
    title: SERIOUS_EXPLAINER.title,
    description: SERIOUS_EXPLAINER.description,
    image: SERIOUS_EXPLAINER.image,
  });
}

export default function SeriousCitationExplainerPage() {
  return (
    <GatedArticleFrame
      path={SERIOUS_EXPLAINER.path}
      title={SERIOUS_EXPLAINER.title}
      description={SERIOUS_EXPLAINER.description}
      datePublished={SERIOUS_EXPLAINER.datePublished}
      eyebrow="Library"
      heading={<>What a serious citation means <em>in each state</em></>}
      image={SERIOUS_EXPLAINER.image}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Library", path: "/library" },
        { name: SERIOUS_EXPLAINER.title, path: SERIOUS_EXPLAINER.path },
      ]}
    >
      <SeriousCitationExplainer />
    </GatedArticleFrame>
  );
}

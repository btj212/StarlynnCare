import type { Metadata } from "next";
import { GatedArticleFrame } from "@/components/articles/GatedArticleFrame";
import { MissouriDesignationBody } from "@/components/articles/DesignationBodies";
import { metadataForGatedArticle } from "@/lib/content/articleReview";
import { MISSOURI_DESIGNATION } from "@/lib/content/designationArticles";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForGatedArticle({
    path: MISSOURI_DESIGNATION.path,
    title: MISSOURI_DESIGNATION.title,
    description: MISSOURI_DESIGNATION.description,
    image: MISSOURI_DESIGNATION.image,
  });
}

export default function MissouriMemoryCareDesignationPage() {
  return (
    <GatedArticleFrame
      path={MISSOURI_DESIGNATION.path}
      title={MISSOURI_DESIGNATION.title}
      description={MISSOURI_DESIGNATION.description}
      datePublished={MISSOURI_DESIGNATION.datePublished}
      eyebrow="Missouri"
      heading={<>Is this Missouri home licensed for <em>memory care</em>?</>}
      image={MISSOURI_DESIGNATION.image}
      faq={MISSOURI_DESIGNATION.faq}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Missouri", path: "/missouri" },
        { name: MISSOURI_DESIGNATION.title, path: MISSOURI_DESIGNATION.path },
      ]}
      nav={{
        badge: "Missouri",
        countStateCode: "MO",
        ctaHref: "/missouri/facilities",
        ctaLabel: "Missouri memory care facilities",
        stateNavHref: "/missouri",
      }}
    >
      <MissouriDesignationBody />
    </GatedArticleFrame>
  );
}

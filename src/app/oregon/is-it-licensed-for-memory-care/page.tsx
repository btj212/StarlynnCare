import type { Metadata } from "next";
import { GatedArticleFrame } from "@/components/articles/GatedArticleFrame";
import { OregonDesignationBody } from "@/components/articles/DesignationBodies";
import { metadataForGatedArticle } from "@/lib/content/articleReview";
import { OREGON_DESIGNATION } from "@/lib/content/designationArticles";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForGatedArticle({
    path: OREGON_DESIGNATION.path,
    title: OREGON_DESIGNATION.title,
    description: OREGON_DESIGNATION.description,
    image: OREGON_DESIGNATION.image,
  });
}

export default function OregonMemoryCareEndorsementPage() {
  return (
    <GatedArticleFrame
      path={OREGON_DESIGNATION.path}
      title={OREGON_DESIGNATION.title}
      description={OREGON_DESIGNATION.description}
      datePublished={OREGON_DESIGNATION.datePublished}
      eyebrow="Oregon"
      heading={<>Is this Oregon home endorsed for <em>memory care</em>?</>}
      image={OREGON_DESIGNATION.image}
      faq={OREGON_DESIGNATION.faq}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Oregon", path: "/oregon" },
        { name: OREGON_DESIGNATION.title, path: OREGON_DESIGNATION.path },
      ]}
      nav={{
        badge: "Oregon",
        countStateCode: "OR",
        ctaHref: "/oregon/facilities",
        ctaLabel: "Oregon memory care facilities",
        stateNavHref: "/oregon",
      }}
    >
      <OregonDesignationBody />
    </GatedArticleFrame>
  );
}

import type { Metadata } from "next";
import { GatedArticleFrame } from "@/components/articles/GatedArticleFrame";
import { PennsylvaniaDesignationBody } from "@/components/articles/DesignationBodies";
import { metadataForGatedArticle } from "@/lib/content/articleReview";
import { PENNSYLVANIA_DESIGNATION } from "@/lib/content/designationArticles";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForGatedArticle({
    path: PENNSYLVANIA_DESIGNATION.path,
    title: PENNSYLVANIA_DESIGNATION.title,
    description: PENNSYLVANIA_DESIGNATION.description,
    image: PENNSYLVANIA_DESIGNATION.image,
  });
}

export default function PennsylvaniaMemoryCareDesignationPage() {
  return (
    <GatedArticleFrame
      path={PENNSYLVANIA_DESIGNATION.path}
      title={PENNSYLVANIA_DESIGNATION.title}
      description={PENNSYLVANIA_DESIGNATION.description}
      datePublished={PENNSYLVANIA_DESIGNATION.datePublished}
      eyebrow="Pennsylvania"
      heading={<>Is this Pennsylvania home licensed for <em>memory care</em>?</>}
      image={PENNSYLVANIA_DESIGNATION.image}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Pennsylvania", path: "/pennsylvania" },
        { name: PENNSYLVANIA_DESIGNATION.title, path: PENNSYLVANIA_DESIGNATION.path },
      ]}
      nav={{
        badge: "Pennsylvania",
        countStateCode: "PA",
        ctaHref: "/pennsylvania/facilities",
        ctaLabel: "Pennsylvania memory care facilities",
        stateNavHref: "/pennsylvania",
      }}
    >
      <PennsylvaniaDesignationBody />
    </GatedArticleFrame>
  );
}

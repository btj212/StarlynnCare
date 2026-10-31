import type { Metadata } from "next";
import { GatedArticleFrame } from "@/components/articles/GatedArticleFrame";
import { TexasDesignationBody } from "@/components/articles/DesignationBodies";
import { metadataForGatedArticle } from "@/lib/content/articleReview";
import { TEXAS_DESIGNATION } from "@/lib/content/designationArticles";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForGatedArticle({
    path: TEXAS_DESIGNATION.path,
    title: TEXAS_DESIGNATION.title,
    description: TEXAS_DESIGNATION.description,
    image: TEXAS_DESIGNATION.image,
  });
}

export default function TexasAlzheimerCertificationPage() {
  return (
    <GatedArticleFrame
      path={TEXAS_DESIGNATION.path}
      title={TEXAS_DESIGNATION.title}
      description={TEXAS_DESIGNATION.description}
      datePublished={TEXAS_DESIGNATION.datePublished}
      eyebrow="Texas"
      heading={<>Is this Texas home certified for <em>Alzheimer&apos;s care</em>?</>}
      image={TEXAS_DESIGNATION.image}
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Texas", path: "/texas" },
        { name: TEXAS_DESIGNATION.title, path: TEXAS_DESIGNATION.path },
      ]}
      nav={{
        badge: "Texas",
        countStateCode: "TX",
        ctaHref: "/texas/facilities",
        ctaLabel: "Texas memory care facilities",
        stateNavHref: "/texas",
      }}
    >
      <TexasDesignationBody />
    </GatedArticleFrame>
  );
}

import type { Metadata } from "next";
import { MinnesotaHowToCheckBody } from "@/components/articles/HowToCheckBodies";
import { HowToCheckPage } from "@/components/articles/HowToCheckPage";
import { metadataForGatedArticle } from "@/lib/content/articleReview";
import { HOW_TO_CHECK } from "@/lib/content/howToCheckArticles";

const article = HOW_TO_CHECK.MN;

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForGatedArticle({
    path: article.path,
    title: article.title,
    description: article.description,
    image: article.image,
  });
}

export default function MinnesotaHowToCheckPage() {
  return (
    <HowToCheckPage code="MN">
      <MinnesotaHowToCheckBody />
    </HowToCheckPage>
  );
}

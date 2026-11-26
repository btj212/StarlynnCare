import Link from "next/link";
import { SectionHead } from "@/components/editorial/SectionHead";
import { getArticlesForState } from "@/lib/content/articleRegistry";

const PRIORITY_TAGS = new Set(["inspection", "costs", "licensing", "decision"]);

/**
 * Three to four related guides on a city hub — text links only, no images,
 * so the extra block does not add weight above the fold.
 */
export function CityRelatedGuides({
  stateCode,
  stateName,
}: {
  stateCode: string;
  stateName: string;
}) {
  const articles = getArticlesForState(stateCode)
    .filter((article) => article.tags.some((tag) => PRIORITY_TAGS.has(tag)))
    .slice(0, 4);
  if (articles.length === 0) return null;

  return (
    <section
      id="related-guides"
      className="border-b border-clearing-rule"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-[60px]">
        <SectionHead
          label="Related guides"
          title={
            <>
              Read next for {stateName} <em>memory care.</em>
            </>
          }
        />
        <ul className="m-0 grid max-w-[72ch] list-none gap-3 p-0">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link
                href={article.slug}
                className="text-[16px] font-medium text-teal underline underline-offset-4"
              >
                {article.title}
              </Link>
              <span className="mt-1 block font-[family-name:var(--font-sans)] text-[14px] text-ink-3">
                {article.desc}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

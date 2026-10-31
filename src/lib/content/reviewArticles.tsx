import type { ReactNode } from "react";
import { SeriousCitationsByState } from "@/components/articles/SeriousCitationsByState";

/** One deslop pass: the sentence before, the sentence after, and what was cut. */
export type DeslopPass = {
  before: string;
  after: string;
  cut: string;
};

export type DeslopSection = {
  heading: string;
  passes: [DeslopPass, DeslopPass];
};

/**
 * An article that stays off the public site until /admin/articles approves it.
 * The body is the same component the public page renders.
 */
export type ReviewArticle = {
  path: string;
  title: string;
  illustration: { src: string; alt: string };
  deslop: DeslopSection[];
  Body: () => ReactNode | Promise<ReactNode>;
};

export const REVIEW_ARTICLES: ReviewArticle[] = [
  {
    path: "/research/memory-care-serious-citations-by-state",
    title: "Serious citations at memory care homes, by state",
    illustration: {
      src: "/illustrations/serious-citations-by-state.png",
      alt: "Illustrated wooden table by a window, with a closed folder, a cup, and a small plant — standing in for a family reading a state's inspection record",
    },
    Body: SeriousCitationsByState,
    deslop: [
      {
        heading: "The count",
        passes: [
          {
            before:
              "This comprehensive, real-time report illuminates the prevalence of serious citations across our nationwide memory care footprint.",
            after:
              "Each row counts published memory care homes that have been flagged for a serious citation within the trailing twenty-four-month lookback window.",
            cut: "comprehensive, real-time, illuminates, prevalence, nationwide, footprint",
          },
          {
            before:
              "Each row counts published memory care homes that have been flagged for a serious citation within the trailing twenty-four-month lookback window.",
            after:
              "Each row counts published memory care homes with a serious citation in the last 24 months.",
            cut: "flagged, trailing lookback window",
          },
        ],
      },
      {
        heading: "What serious means",
        passes: [
          {
            before:
              "A serious citation is essentially a Type A finding or, broadly speaking, any finding stored at severity 3 or higher, which we believe families should understand.",
            after:
              "The operational definition of a serious citation is a Type A class or a stored severity integer of three or above. The metric is a facility count rather than a finding count, aligned to the /data aggregate.",
            cut: "essentially, broadly speaking, we believe families should understand",
          },
          {
            before:
              "The operational definition of a serious citation is a Type A class or a stored severity integer of three or above. The metric is a facility count rather than a finding count, aligned to the /data aggregate.",
            after:
              "A serious citation in this count is a Type A finding, or a finding stored at severity 3 or higher, on an inspection in the last 24 months. The figure counts homes, not findings. It matches the table on /data.",
            cut: "operational definition, severity integer, metric, aggregate",
          },
        ],
      },
      {
        heading: "Profile tags",
        passes: [
          {
            before:
              "It is important to note that the profile's red tag may potentially differ from this broader count in certain states.",
            after:
              "On a facility profile, the red tag can be narrower than this count. The note under each state says what that profile calls its top tag, so readers can contextualize the methodology.",
            cut: "it is important to note, potentially, certain states",
          },
          {
            before:
              "On a facility profile, the red tag can be narrower than this count. The note under each state says what that profile calls its top tag, so readers can contextualize the methodology.",
            after:
              "On a facility profile, the red tag can be narrower than this count. The note under each state says what that profile calls its top tag.",
            cut: "contextualize the methodology",
          },
        ],
      },
      {
        heading: "Inspection coverage",
        passes: [
          {
            before:
              "Some states have robust inspection coverage while others are still ramping up, but the data is directionally useful.",
            after:
              "A home with no inspection on file is excluded from the serious-citation numerator. Coverage and the latest inspection timestamp are disclosed per state.",
            cut: "robust, ramping up, directionally useful",
          },
          {
            before:
              "A home with no inspection on file is excluded from the serious-citation numerator. Coverage and the latest inspection timestamp are disclosed per state.",
            after:
              "A home with no inspection on file is not in the serious-citation count. The line for each state says how many published homes have an inspection, and the newest inspection date we hold.",
            cut: "numerator, timestamp, disclosed",
          },
        ],
      },
    ],
  },
];

export function reviewArticleByPath(path: string): ReviewArticle | null {
  return REVIEW_ARTICLES.find((article) => article.path === path) ?? null;
}

export function gatedArticlePaths(): Set<string> {
  return new Set(REVIEW_ARTICLES.map((article) => article.path));
}

/** Approve is refused until every section has two complete passes. */
export function deslopIssues(article: ReviewArticle): string[] {
  const issues: string[] = [];
  if (article.deslop.length === 0) {
    issues.push("The deslop log has no sections.");
  }
  for (const section of article.deslop) {
    if (section.passes.length !== 2) {
      issues.push(`${section.heading} needs two passes.`);
      continue;
    }
    section.passes.forEach((pass, index) => {
      if (!pass.before.trim() || !pass.after.trim() || !pass.cut.trim()) {
        issues.push(
          `${section.heading}, pass ${index + 1}, is missing the before, the after, or what was cut.`,
        );
      }
    });
  }
  return issues;
}

import type { ReactNode } from "react";
import {
  MissouriDesignationBody,
  OregonDesignationBody,
  PennsylvaniaDesignationBody,
  TexasDesignationBody,
} from "@/components/articles/DesignationBodies";
import {
  ArizonaHowToCheckBody,
  CaliforniaHowToCheckBody,
  PennsylvaniaHowToCheckBody,
  WashingtonHowToCheckBody,
} from "@/components/articles/HowToCheckBodies";
import { SeriousCitationExplainer } from "@/components/articles/SeriousCitationExplainer";
import { SeriousCitationsByState } from "@/components/articles/SeriousCitationsByState";
import {
  MISSOURI_DESIGNATION,
  OREGON_DESIGNATION,
  PENNSYLVANIA_DESIGNATION,
  TEXAS_DESIGNATION,
} from "@/lib/content/designationArticles";
import {
  MISSOURI_DESIGNATION_DESLOP,
  OREGON_DESIGNATION_DESLOP,
  PENNSYLVANIA_DESIGNATION_DESLOP,
  TEXAS_DESIGNATION_DESLOP,
} from "@/lib/content/designationDeslop";
import { HOW_TO_CHECK } from "@/lib/content/howToCheckArticles";
import { SERIOUS_EXPLAINER } from "@/lib/content/seriousExplainer";
import { SERIOUS_EXPLAINER_DESLOP } from "@/lib/content/seriousExplainerDeslop";
import {
  ARIZONA_HOW_TO_DESLOP,
  CALIFORNIA_HOW_TO_DESLOP,
  PENNSYLVANIA_HOW_TO_DESLOP,
  WASHINGTON_HOW_TO_DESLOP,
} from "@/lib/content/howToCheckDeslop";

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
      {
        heading: "Which states are left out?",
        passes: [
          {
            before:
              "We excluded states with incomplete data so this trusted report only shows the states families can rely on. Oregon has zero serious citations.",
            after:
              "This table leaves out a state when the serious count would not be a measurement. Oregon has zero serious citations.",
            cut: "excluded, incomplete, trusted, families can rely on",
          },
          {
            before:
              "This table leaves out a state when the serious count would not be a measurement. Oregon has zero serious citations.",
            after:
              "This table leaves out a state when the serious count would not be a measurement. The dataset page still lists every covered state.",
            cut: "zero serious citations",
          },
        ],
      },
    ],
  },
  {
    path: OREGON_DESIGNATION.path,
    title: OREGON_DESIGNATION.title,
    illustration: OREGON_DESIGNATION.image,
    Body: OregonDesignationBody,
    deslop: OREGON_DESIGNATION_DESLOP,
  },
  {
    path: PENNSYLVANIA_DESIGNATION.path,
    title: PENNSYLVANIA_DESIGNATION.title,
    illustration: PENNSYLVANIA_DESIGNATION.image,
    Body: PennsylvaniaDesignationBody,
    deslop: PENNSYLVANIA_DESIGNATION_DESLOP,
  },
  {
    path: MISSOURI_DESIGNATION.path,
    title: MISSOURI_DESIGNATION.title,
    illustration: MISSOURI_DESIGNATION.image,
    Body: MissouriDesignationBody,
    deslop: MISSOURI_DESIGNATION_DESLOP,
  },
  {
    path: TEXAS_DESIGNATION.path,
    title: TEXAS_DESIGNATION.title,
    illustration: TEXAS_DESIGNATION.image,
    Body: TexasDesignationBody,
    deslop: TEXAS_DESIGNATION_DESLOP,
  },
  {
    path: HOW_TO_CHECK.AZ.path,
    title: HOW_TO_CHECK.AZ.title,
    illustration: HOW_TO_CHECK.AZ.image,
    Body: ArizonaHowToCheckBody,
    deslop: ARIZONA_HOW_TO_DESLOP,
  },
  {
    path: HOW_TO_CHECK.CA.path,
    title: HOW_TO_CHECK.CA.title,
    illustration: HOW_TO_CHECK.CA.image,
    Body: CaliforniaHowToCheckBody,
    deslop: CALIFORNIA_HOW_TO_DESLOP,
  },
  {
    path: HOW_TO_CHECK.PA.path,
    title: HOW_TO_CHECK.PA.title,
    illustration: HOW_TO_CHECK.PA.image,
    Body: PennsylvaniaHowToCheckBody,
    deslop: PENNSYLVANIA_HOW_TO_DESLOP,
  },
  {
    path: HOW_TO_CHECK.WA.path,
    title: HOW_TO_CHECK.WA.title,
    illustration: HOW_TO_CHECK.WA.image,
    Body: WashingtonHowToCheckBody,
    deslop: WASHINGTON_HOW_TO_DESLOP,
  },
  {
    path: SERIOUS_EXPLAINER.path,
    title: SERIOUS_EXPLAINER.title,
    illustration: SERIOUS_EXPLAINER.image,
    Body: SeriousCitationExplainer,
    deslop: SERIOUS_EXPLAINER_DESLOP,
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

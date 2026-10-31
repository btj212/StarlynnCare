import type { ReactNode } from "react";

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

export const REVIEW_ARTICLES: ReviewArticle[] = [];

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

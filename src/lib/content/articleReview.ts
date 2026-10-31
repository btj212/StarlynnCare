import type { Metadata } from "next";
import { canonicalFor } from "@/lib/seo/canonical";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { gatedArticlePaths } from "@/lib/content/reviewArticles";

export function isGatedPath(path: string): boolean {
  return gatedArticlePaths().has(path);
}

/** Approved gated paths. A query error returns none, so a draft stays hidden. */
export async function loadApprovedPaths(): Promise<Set<string>> {
  const gated = gatedArticlePaths();
  if (gated.size === 0) return new Set();
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("article_reviews")
    .select("path")
    .eq("status", "approved");
  if (error || !data) return new Set();
  const approved = new Set<string>();
  for (const row of data as Array<{ path: string }>) {
    if (gated.has(row.path)) approved.add(row.path);
  }
  return approved;
}

export async function isArticleApproved(path: string): Promise<boolean> {
  if (!isGatedPath(path)) return true;
  const approved = await loadApprovedPaths();
  return approved.has(path);
}

/** Public metadata for a gated article. A draft is marked noindex. */
export async function metadataForGatedArticle(input: {
  path: string;
  title: string;
  description: string;
  image: { src: string; alt: string };
}): Promise<Metadata> {
  if (!(await isArticleApproved(input.path))) {
    return { title: input.title, robots: { index: false, follow: false } };
  }
  const canonical = canonicalFor(input.path);
  const title = `${input.title} | StarlynnCare`;
  return {
    title,
    description: input.description,
    alternates: { canonical },
    openGraph: {
      title,
      description: input.description,
      url: canonical,
      type: "article",
      images: [{ url: input.image.src, alt: input.image.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: input.description,
      images: [input.image.src],
    },
  };
}

export function keepApproved<T>(
  items: T[],
  pathOf: (item: T) => string,
  approved: Set<string>,
): T[] {
  return items.filter((item) => {
    const path = pathOf(item);
    return !isGatedPath(path) || approved.has(path);
  });
}

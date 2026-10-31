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

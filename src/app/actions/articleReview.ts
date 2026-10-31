"use server";

import { existsSync } from "node:fs";
import path from "node:path";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { currentUserIsAdmin } from "@/lib/admin/auth";
import { deslopIssues, reviewArticleByPath } from "@/lib/content/reviewArticles";
import { getServiceClient } from "@/lib/supabase/server";

export type ArticleActionResult = { ok: true } | { ok: false; issues: string[] };

async function requireAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await currentUserIsAdmin())) throw new Error("Forbidden");
  const user = await currentUser();
  return user?.emailAddresses?.[0]?.emailAddress ?? userId;
}

function illustrationIssues(src: string): string[] {
  const relative = src.replace(/^\//, "");
  const file = path.join(process.cwd(), "public", relative);
  if (!existsSync(file)) {
    return [`The illustration file is missing: ${src}`];
  }
  return [];
}

function revalidateArticle(articlePath: string): void {
  revalidatePath(articlePath);
  revalidatePath("/sitemap.xml");
  revalidatePath("/sitemap-static.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/admin/articles");
  revalidatePath("/library");
  revalidatePath("/research");
}

export async function approveArticle(
  articlePath: string,
  note: string,
): Promise<ArticleActionResult> {
  const email = await requireAdmin();
  const article = reviewArticleByPath(articlePath);
  if (!article) return { ok: false, issues: ["That article is not in the review list."] };

  const issues = [...deslopIssues(article), ...illustrationIssues(article.illustration.src)];
  if (issues.length) return { ok: false, issues };

  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("article_reviews").upsert({
    path: articlePath,
    status: "approved",
    note: note.trim() || null,
    approved_by: email,
    approved_at: now,
    updated_at: now,
  });
  if (error) return { ok: false, issues: [error.message] };

  revalidateArticle(articlePath);
  return { ok: true };
}

export async function holdArticle(
  articlePath: string,
  note: string,
): Promise<ArticleActionResult> {
  await requireAdmin();
  const article = reviewArticleByPath(articlePath);
  if (!article) return { ok: false, issues: ["That article is not in the review list."] };

  const supabase = getServiceClient();
  const { error } = await supabase.from("article_reviews").upsert({
    path: articlePath,
    status: "held",
    note: note.trim() || null,
    approved_by: null,
    approved_at: null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, issues: [error.message] };

  revalidateArticle(articlePath);
  return { ok: true };
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleReviewForm } from "@/app/admin/articles/ArticleReviewForm";
import { reviewArticleByPath } from "@/lib/content/reviewArticles";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminArticleReviewPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: segments } = await params;
  const articlePath = `/${segments.join("/")}`;
  const article = reviewArticleByPath(articlePath);
  if (!article) notFound();

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("article_reviews")
    .select("status, note, approved_by, approved_at")
    .eq("path", articlePath)
    .maybeSingle();
  const row = data as {
    status: string;
    note: string | null;
    approved_by: string | null;
    approved_at: string | null;
  } | null;
  const status = row?.status === "approved" || row?.status === "held" ? row.status : "draft";
  const Body = article.Body;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/articles" className="text-sm text-gray-500 hover:text-ink">
          Articles
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{article.title}</h1>
        <p className="mt-1 font-mono text-xs text-gray-500">
          {articlePath} · {status}
          {row?.approved_by ? ` · ${row.approved_by}` : ""}
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-[var(--color-paper)] p-6">
        <Image
          src={article.illustration.src}
          alt={article.illustration.alt}
          width={1024}
          height={768}
          className="h-auto w-full max-w-[720px]"
        />
        <div className="mt-6">
          <Body />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-navy">Deslop log</h2>
        {article.deslop.map((section) => (
          <div key={section.heading} className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">{section.heading}</h3>
            {section.passes.map((pass, index) => (
              <div key={`${section.heading}-${index}`} className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                <p className="font-mono text-[11px] uppercase tracking-wide text-gray-400">
                  Pass {index + 1}
                </p>
                <p className="mt-2 text-gray-500">Before: {pass.before}</p>
                <p className="mt-2 text-ink">After: {pass.after}</p>
                <p className="mt-2 text-gray-500">Cut: {pass.cut}</p>
              </div>
            ))}
          </div>
        ))}
      </section>

      <ArticleReviewForm articlePath={articlePath} />
    </div>
  );
}

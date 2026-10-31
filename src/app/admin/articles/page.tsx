import Link from "next/link";
import { REVIEW_ARTICLES } from "@/lib/content/reviewArticles";
import { getServiceClient } from "@/lib/supabase/server";

type ReviewStatus = "draft" | "held" | "approved";

type ReviewRow = {
  path: string;
  status: string;
  note: string | null;
  approved_by: string | null;
  updated_at: string;
};

async function loadReviews(): Promise<ReviewRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("article_reviews")
    .select("path, status, note, approved_by, updated_at");
  if (error) {
    console.error("Admin article review load error:", error);
    return [];
  }
  return (data ?? []) as ReviewRow[];
}

function statusFor(path: string, rows: ReviewRow[]): ReviewStatus {
  const row = rows.find((item) => item.path === path);
  if (row?.status === "approved") return "approved";
  if (row?.status === "held") return "held";
  return "draft";
}

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "draft" } = await searchParams;
  const rows = await loadReviews();
  const articles = REVIEW_ARTICLES.map((article) => ({
    ...article,
    status: statusFor(article.path, rows),
  }));
  const counts = {
    draft: articles.filter((article) => article.status === "draft").length,
    held: articles.filter((article) => article.status === "held").length,
    approved: articles.filter((article) => article.status === "approved").length,
  };
  const visible = articles.filter((article) => article.status === filter);
  const tabs = [
    { key: "draft", label: "Draft" },
    { key: "held", label: "Held" },
    { key: "approved", label: "Approved" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Articles</h1>
        <p className="mt-1 text-sm text-gray-500">
          An article stays off the public site, the sitemap, and llms.txt until it is approved here.
        </p>
      </div>
      <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`?filter=${tab.key}`}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filter === tab.key ? "bg-white text-ink shadow-sm" : "text-gray-500 hover:text-ink"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
              {counts[tab.key as keyof typeof counts]}
            </span>
          </a>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No {filter} articles.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((article) => (
            <li key={article.path} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <Link
                href={`/admin/articles${article.path}`}
                className="font-medium text-navy hover:underline"
              >
                {article.title}
              </Link>
              <p className="mt-1 font-mono text-xs text-gray-500">{article.path}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

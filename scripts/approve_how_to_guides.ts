/**
 * Approves the inspection-record guides after the same checks as
 * /admin/articles: two deslop passes on every section, and an illustration
 * file on disk. Writes article_reviews with the service role.
 *
 * Usage: npx tsx scripts/approve_how_to_guides.ts
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { deslopIssues, reviewArticleByPath } from "../src/lib/content/reviewArticles.tsx";

config({ path: path.resolve(process.cwd(), ".env.local") });

const PATHS = [
  "/arizona/how-to-check-a-memory-care-record",
  "/california/how-to-check-a-memory-care-record",
  "/pennsylvania/how-to-check-a-memory-care-record",
  "/washington/how-to-check-a-memory-care-record",
  "/oregon/how-to-check-a-memory-care-record",
  "/illinois/how-to-check-a-memory-care-record",
  "/minnesota/how-to-check-a-memory-care-record",
];

function illustrationIssues(src: string): string[] {
  const relative = src.replace(/^\//, "");
  const file = path.join(process.cwd(), "public", relative);
  return existsSync(file) ? [] : [`The illustration file is missing: ${src}`];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Supabase service credentials are missing.");
  process.exit(1);
}

const failures: string[] = [];
for (const articlePath of PATHS) {
  const article = reviewArticleByPath(articlePath);
  if (!article) {
    failures.push(`${articlePath} is not in the review list`);
    continue;
  }
  const issues = [...deslopIssues(article), ...illustrationIssues(article.illustration.src)];
  if (issues.length) failures.push(`${articlePath}: ${issues.join("; ")}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

async function approve(): Promise<void> {
  const supabase = createClient(url, service);
  const now = new Date().toISOString();
  const note =
    "Checked the two-pass editorial log and the illustration file before approval.";

  for (const articlePath of PATHS) {
    const { error } = await supabase.from("article_reviews").upsert({
      path: articlePath,
      status: "approved",
      note,
      approved_by: "editorial gate",
      approved_at: now,
      updated_at: now,
    });
    if (error) {
      console.error(`${articlePath} was not approved: ${error.message}`);
      process.exit(1);
    }
    console.log(`approved ${articlePath}`);
  }
}

approve();

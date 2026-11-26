import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The Venmo donation ask was removed site-wide. Fail CI if "venmo" returns
 * in src/ or public/ (components, copy, QR filenames, env references).
 */
const ROOT = process.cwd();
const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const hits: string[] = [];
for (const folder of ["src", "public"]) {
  const root = join(ROOT, folder);
  for (const file of walk(root)) {
    const rel = relative(ROOT, file);
    if (/venmo/i.test(rel)) {
      hits.push(rel);
      continue;
    }
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    if (SKIP_EXT.has(ext)) continue;
    const text = readFileSync(file, "utf8");
    if (/venmo/i.test(text)) hits.push(rel);
  }
}

assert.deepEqual(hits, [], `venmo still present in:\n${hits.join("\n")}`);
console.log("no venmo strings in src/public");

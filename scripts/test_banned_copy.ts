/**
 * Why this scan exists:
 * A facility or hub page was calling a window of zero "None on record",
 * printing "Top N%" from a percentile, and using "best" or "ranked" as a
 * quality claim. Those phrases are banned in rendered copy. "Inspection
 * record" is the document and is allowed. "on record" and "no citations"
 * are allowed only when the same sentence names a window or "records we
 * hold". Code comments and identifiers are not rendered copy.
 *
 * Run: npm run test:banned-copy
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROOTS = [
  "src/components",
  "src/app",
  "src/lib/seo",
  "src/lib/watch",
  "src/lib/email",
  "src/lib/content",
  "src/lib/city-hub",
  "src/lib/facility/homeOutreach.ts",
  "src/lib/data",
  "src/lib/facility",
  "src/lib/llms",
  "public",
];

const EXTENSIONS = new Set([".ts", ".tsx", ".md", ".mdx", ".html", ".txt"]);
const PROSE_EXTENSIONS = new Set([".md", ".mdx", ".html", ".txt"]);

/**
 * A hit stays only with a one-line reason. The excerpt must appear in the
 * same file, and an unused entry fails the test.
 */
const ALLOWLIST: { file: string; includes: string; why: string }[] = [
  // Colorado names two regulators so a reader does not treat them as one list.
  {
    file: "src/app/[state]/page.tsx",
    includes: "not ranked together",
    why: "Says Colorado assisted living and nursing homes are not ranked together, so the two settings are not compared as one list.",
  },
  // The methodology page is where the percentile cutoffs are defined.
  {
    file: "src/app/methodology/page.tsx",
    includes: "percentile",
    why: "The methodology page explains the percentile cutoffs behind a peer comparison. It is not a home's rank badge.",
  },
  {
    file: "src/app/methodology/page.tsx",
    includes: "Percentile",
    why: "Same methodology explanation, on the lines that capitalize the word.",
  },
  // Deslop guides quote the wording they tell a writer to cut.
  {
    file: "src/lib/content/howToCheckDeslop.ts",
    includes: "best",
    why: "The before-and-cut lines are wording the guide tells writers to remove, not a claim on a facility page.",
  },
  {
    file: "src/lib/content/designationDeslop.ts",
    includes: "best",
    why: "The before-and-cut lines are wording the guide tells writers to remove, not a claim on a facility page.",
  },
];

const BANNED: { name: string; pattern: RegExp; qualify?: boolean }[] = [
  { name: "top-rated", pattern: /top-rated/i },
  { name: "Top N%", pattern: /Top \d+%/i },
  { name: "ranked in the top", pattern: /ranked in the top/i },
  { name: "None on record", pattern: /None on record/ },
  { name: "on record", pattern: /\bon record\b/i, qualify: true },
  { name: "best", pattern: /\bbest\b(?!-)/i },
  { name: "rank", pattern: /\brank(?:ed|ing|ings)?\b/i },
  { name: "percentile", pattern: /\bpercentiles?\b/i },
  { name: "top performers", pattern: /top performers/i },
  { name: "no citations", pattern: /\bno citations\b/i, qualify: true },
];

const WINDOW_QUALIFIER =
  /last 3 years|last three years|in 3 yrs|36 months|3-year|three-year|all years|records we hold|in that window/i;

function jsxText(chunk: string): boolean {
  if (!/[A-Za-z]/.test(chunk) || chunk.includes("{")) return false;
  if (/\/\/|\/\*|\b(?:const|return|function|import)\b/.test(chunk)) return false;
  return true;
}

/** Keep string literals and JSX text. Blank code, comments, and identifiers. */
function renderedCopy(source: string, prose: boolean): string {
  if (prose) {
    return source.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, " "));
  }
  let out = "";
  let i = 0;
  let state: "code" | "line" | "block" | "s" | "d" | "t" = "code";
  // Each `${` pushes a brace depth so a nested template can close and return here.
  const exprDepths: number[] = [];
  let brace = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'") {
        state = "s";
        out += " ";
        i += 1;
        continue;
      }
      if (c === '"') {
        state = "d";
        out += " ";
        i += 1;
        continue;
      }
      if (c === "`") {
        state = "t";
        out += " ";
        i += 1;
        continue;
      }
      if (c === ">") {
        const rest = source.slice(i + 1);
        const close = rest.indexOf("<");
        if (close > 0 && jsxText(rest.slice(0, close))) {
          out += " ";
          out += rest.slice(0, close);
          i += 1 + close;
          continue;
        }
      }
      if (c === "{") {
        if (exprDepths.length > 0) exprDepths[exprDepths.length - 1] += 1;
        else brace += 1;
      } else if (c === "}") {
        if (exprDepths.length > 0) {
          exprDepths[exprDepths.length - 1] -= 1;
          if (exprDepths[exprDepths.length - 1] === 0) {
            exprDepths.pop();
            state = "t";
          }
        } else if (brace > 0) brace -= 1;
      }
      out += c === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += "\n";
      }
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }
    if (state === "t" && c === "$" && next === "{") {
      state = "code";
      exprDepths.push(1);
      out += "  ";
      i += 2;
      continue;
    }
    if (
      ((state === "s" && c === "'") || (state === "d" && c === '"') || (state === "t" && c === "`")) &&
      source[i - 1] !== "\\"
    ) {
      state = "code";
      out += " ";
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function filesUnder(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  let info;
  try {
    info = statSync(abs);
  } catch {
    return [];
  }
  if (info.isFile()) return [rel];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const child = path.join(rel, name);
    const childAbs = path.join(ROOT, child);
    if (statSync(childAbs).isDirectory()) out.push(...filesUnder(child));
    else if (EXTENSIONS.has(path.extname(name))) out.push(child);
  }
  return out;
}

function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}

function sentenceAt(text: string, index: number): string {
  let start = index;
  while (start > 0 && !/[.!?\n]/.test(text[start - 1]!)) start -= 1;
  let end = index;
  while (end < text.length && !/[.!?\n]/.test(text[end]!)) end += 1;
  return text.slice(start, end);
}

const hits: string[] = [];
const usedAllow = new Set<number>();

for (const rel of ROOTS.flatMap(filesUnder)) {
  const raw = readFileSync(path.join(ROOT, rel), "utf8");
  const prose = PROSE_EXTENSIONS.has(path.extname(rel));
  const text = renderedCopy(raw, prose);
  for (const rule of BANNED) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const re = new RegExp(rule.pattern.source, flags);
    for (const match of text.matchAll(re)) {
      const index = match.index ?? 0;
      if (rule.qualify && WINDOW_QUALIFIER.test(sentenceAt(text, index))) continue;
      const line = lineAt(text, index).trim();
      if (!line) continue;
      const allowed = ALLOWLIST.findIndex(
        (entry, entryIndex) =>
          entry.file === rel &&
          line.includes(entry.includes) &&
          usedAllow.add(entryIndex) === usedAllow,
      );
      if (allowed >= 0) continue;
      hits.push(`${rel}: ${rule.name}: ${line}`);
    }
  }
}

for (const [index, entry] of ALLOWLIST.entries()) {
  assert.ok(entry.why.trim().length > 0, `allowlist entry ${index} needs a one-line reason`);
  assert.ok(usedAllow.has(index), `allowlist entry is unused: ${entry.file} (${entry.why})`);
}

assert.deepEqual(hits, [], hits.join("\n"));

const kept = "3 citations on record in the last 3 years";
assert.equal(WINDOW_QUALIFIER.test(sentenceAt(kept, kept.indexOf("on record"))), true);
assert.equal(/\bon record\b/i.test("View the inspection record"), false);
assert.equal(/None on record/.test("No inspection date in the records we hold"), false);
const nearby = "The file is on record.\nCounts use the last 3 years.";
assert.equal(WINDOW_QUALIFIER.test(sentenceAt(nearby, nearby.indexOf("on record"))), false);
const windowed = "no citations in 3 yrs";
assert.equal(WINDOW_QUALIFIER.test(sentenceAt(windowed, windowed.indexOf("no citations"))), true);
const bare = 'const percentile = 1; const label = "ranked in the top";';
const masked = renderedCopy(bare, false);
assert.equal(/\bpercentile\b/i.test(masked), false);
assert.match(masked, /ranked in the top/);

console.log(`banned copy: ok (${ALLOWLIST.length} allowlist)`);

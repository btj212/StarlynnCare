/**
 * Why this scan exists:
 * A facility or hub page was calling a window of zero "None on record" and
 * printing "Top N%" from a percentile. Those phrases are banned in rendered
 * copy. "Inspection record" is the document and is allowed. "on record" is
 * allowed only in a string that also names a window or "records we hold since".
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
];

const EXTENSIONS = new Set([".ts", ".tsx", ".md", ".mdx", ".html"]);

/**
 * A hit stays only with a one-line reason. The excerpt must appear in the
 * same file, and an unused entry fails the test.
 */
const ALLOWLIST: { file: string; includes: string; why: string }[] = [];

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: "top-rated", pattern: /top-rated/i },
  { name: "Top N%", pattern: /Top \d+%/i },
  { name: "ranked in the top", pattern: /ranked in the top/i },
  { name: "None on record", pattern: /None on record/ },
  { name: "on record", pattern: /\bon record\b/i },
];

const WINDOW_QUALIFIER = /last 3 years|last three years|36 months|records we hold since/i;

function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let state: "code" | "line" | "block" | "s" | "d" | "t" = "code";
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
      if (c === "'") state = "s";
      else if (c === '"') state = "d";
      else if (c === "`") state = "t";
      out += c;
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
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
      if (c === "\n") out += "\n";
      i += 1;
      continue;
    }
    out += c;
    if (c === "\\" && next != null) {
      out += next;
      i += 2;
      continue;
    }
    if ((state === "s" && c === "'") || (state === "d" && c === '"') || (state === "t" && c === "`")) {
      state = "code";
    }
    i += 1;
  }
  return out;
}

function filesUnder(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  const info = statSync(abs);
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

function qualified(text: string, index: number): boolean {
  const line = lineAt(text, index);
  if (WINDOW_QUALIFIER.test(line)) return true;
  const around = text.slice(Math.max(0, index - 240), index + 240);
  return WINDOW_QUALIFIER.test(around);
}

const hits: string[] = [];
const usedAllow = new Set<number>();

for (const rel of ROOTS.flatMap(filesUnder)) {
  const raw = readFileSync(path.join(ROOT, rel), "utf8");
  const text = stripComments(raw);
  for (const rule of BANNED) {
    rule.pattern.lastIndex = 0;
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const re = new RegExp(rule.pattern.source, flags);
    for (const match of text.matchAll(re)) {
      const index = match.index ?? 0;
      if (rule.name === "on record" && qualified(text, index)) continue;
      const line = lineAt(text, index).trim();
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
assert.equal(WINDOW_QUALIFIER.test(kept), true);
assert.equal(/\bon record\b/i.test("View the inspection record"), false);
assert.equal(/None on record/.test("No inspection date in the records we hold"), false);

console.log(`banned copy: ok (${ALLOWLIST.length} allowlist)`);

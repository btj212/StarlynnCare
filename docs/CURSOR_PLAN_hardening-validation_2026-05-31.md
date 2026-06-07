# Cursor Plan — Hardening & Validation Pass (May 2026)

A structured, fully gate-checked pass the **Auto model** can run end-to-end against StarlynnCare. Every task is mechanical and verifiable: each one ends in a **GATE** (a command or a written audit artifact) that is either green or it isn't. Nothing in this plan requires editorial, strategic, or architectural judgment — that work is listed under "Out of scope" at the bottom and is reserved for a human.

The value of this pass is **breadth + verification**, not invention: it operates across 850+ facility pages, 117 city/county hubs, ~50 static/editorial pages, and every pure function in `src/lib`, and it loops each task against its gate until green. Much of the SEO infrastructure is already built (see "What already exists" below) — so most workstreams are **verify / validate / close-gaps / report**, not "build from scratch."

---

## Paste this as your first Cursor message

```
Read docs/CURSOR_PLAN_hardening-validation_2026-05-31.md, CLAUDE.md, and AGENTS.md in full before writing any code.

Operating rules for this whole session:
1. One workstream = one branch = one small PR. Never mix workstreams. Branch names: chore/ws-a-jsonld-validate, chore/ws-c-internal-links, etc.
2. Every task has an acceptance GATE (a command or a written audit file). A task is not done until the gate is green / the artifact exists. Run it. Paste the output in the PR.
3. ADD, don't refactor. Do not "improve" adjacent code, rename, reformat, or touch anything outside the task's named files. Match existing style exactly (CLAUDE.md Rule 3 + Rule 11).
4. NEVER touch the data layer: the facility_snapshot RPC, fallback_level logic, grade/percentile/severity computation, or any Supabase migration. READ from them; never change them or derive new published values from them. (CLAUDE.md "Data Accuracy / YMYL".)
5. Prefer extending the existing validation harness in scripts/validate/ (uses _lib.py: check(), run_all_checks(), get_conn(), fetch_page()) over inventing a new test rig.
6. If a task is ambiguous, a gate won't go green after 2 honest attempts, or a task requires a new dependency / new pattern / a judgment call — STOP and write what's blocking you in the PR. Do not guess, do not invent a pattern, do not weaken the gate, do not add a dependency.

Start with Workstream 0 (orientation), then go A → G in order. Confirm the facility page component path and the validation harness before writing anything.
```

---

## What already exists (verified 2026-05-31 — re-confirm in Workstream 0)

| Capability | Where | Status |
|---|---|---|
| JSON-LD: LocalBusiness + MedicalOrganization for facilities | `src/lib/seo/schema.ts` → `buildLocalBusinessForFacility` | Built + wired |
| JSON-LD: BreadcrumbList | `schema.ts` → `buildBreadcrumbList` | Built |
| JSON-LD: CollectionPage + ItemList (hubs) | `schema.ts` → `buildCollectionPageSchema`, `buildStateHubCollectionPage`, `buildItemListSchema` | Built |
| JSON-LD: FAQPage, MedicalWebPage, Dataset, Organization, WebSite, Person | `schema.ts` | Built |
| JSON-LD render component | `src/components/seo/JsonLd.tsx` | Built |
| Title template ≤60 chars, YMYL-guarded | `src/lib/seo/meta.ts` → `buildFacilityTitle` | Built |
| Meta description templates, YMYL-guarded | `meta.ts` → `buildFacilityDescription`, `buildFacilitySnippet` | Built |
| Meta clipper (sentence/word boundary) | `meta.ts` → `clipMetaDescription` (default `max = 160`) | Built |
| Canonical URL helper | `src/lib/seo/canonical.ts` → `canonicalFor`, `SITE_ORIGIN` | Built |
| 3-layer validation harness | `scripts/validate/` (`db_invariants.py`, `content_checks.py`, `smoke_test.py`, `_lib.py`) | Built |
| Sitemap routes | `src/app/sitemap.xml/`, `sitemap-facilities.xml/`, `sitemap-hubs.xml/`, `sitemap-static.xml/` | Built |

**Route components:**
- Facility profile: `src/app/[state]/[city]/[facility]/page.tsx`
- City / county hub: `src/app/[state]/[city]/page.tsx`
- State hub: `src/app/[state]/page.tsx`
- State facilities browse: `src/app/[state]/facilities/page.tsx`

**Two important corrections vs. the older brief:**
1. `aggregateRating` is emitted **only from real published reviews** (`nestedAggregateFromReviews`), never from the snapshot grade. This is the stronger, correct YMYL posture and matches AGENTS.md ("no `aggregateRating` without published reviews"). The validation gate must enforce this exact rule — do **not** add grade-derived ratings.
2. There is **no JS/TS test runner installed** (no Vitest/Jest in `package.json`). Workstream B is therefore **blocked on a dependency decision** (see B).

---

## Non-negotiable fences

1. **Data layer is read-only.** `facility_snapshot` RPC, `fallback_level`, grade/percentile/severity logic, anything in `supabase/migrations/`. Read to render; never mutate, never synthesize. A facility with no grade and no reviews emits **no** rating — not a zero, not a default, not an "N/A star."
2. **Additive over edits.** Where a task can be a new file (audit scripts, link components, tests), make it a new file. Smaller diffs = lower blast radius.
3. **Green-gate or stop.** `npm run build` and `npx tsc --noEmit` must pass before every commit. If they don't, the task isn't done.
4. **No new dependencies, no new patterns.** Use what's installed. Mirror the existing template. Adding a dependency is a STOP-and-ask, not a decision the model makes.
5. **One small PR per workstream.** A 4,000-file diff is not reviewable. Split big workstreams by state or page-type into several PRs.

### Do-not-touch list

```
src/lib/**/snapshot*          ← grade/rating source of truth
**/facility_snapshot*         ← the RPC and its callers' grade logic
supabase/migrations/**        ← never edit existing; this plan adds none
.env, .env.local              ← never
.cursor/plans/**              ← source-of-truth plans, never edit while implementing
src/app/**/layout.tsx tokens  ← don't restyle; palette + fonts are fixed
src/lib/seo/schema.ts logic   ← read it; do not change builder output shape (validate it instead)
src/lib/seo/meta.ts logic     ← read it; do not change template logic (validate it instead)
```

---

## Workstreams (run in order)

Output of read-only audits goes in `docs/audits/` (create the folder). New audit scripts go in `scripts/validate/` and follow the `_lib.py` pattern (`check()`, `run_all_checks()`, exit 0/1).

---

### Workstream 0 — Orientation (read-only, no branch needed)

Re-confirm the "What already exists" table against the live tree before doing anything. This protects against the plan drifting from the code.

| # | Task | GATE |
|---|---|---|
| 0.1 | Open `src/lib/seo/schema.ts` and `src/lib/seo/meta.ts`; confirm the named exports in the table above exist. | Write a one-paragraph confirmation (or list of discrepancies) in the WS-A PR description. |
| 0.2 | Open `src/app/[state]/[city]/[facility]/page.tsx`; confirm it renders `<JsonLd>` with `buildLocalBusinessForFacility` + `buildBreadcrumbList`, and that title/meta come from `buildFacilityTitle` / the meta builders. | Confirmation noted. |
| 0.3 | Confirm `scripts/validate/_lib.py` exposes `check`, `run_all_checks`, `get_conn`, `fetch_page`. Confirm `package.json` has **no** test runner. | Confirmation noted; flags Workstream B as blocked. |

**STOP condition:** if the table is materially wrong (e.g. a builder is missing or not wired), note it and re-scope the affected workstream in the PR before proceeding.

---

### Workstream A — JSON-LD validation (highest value: verify, don't rebuild)

**Why:** the builders and wiring already exist. The risk is silent drift — a page emitting malformed schema, or (the YMYL line) a rating for an ungraded/review-less facility. This workstream proves correctness across sampled pages and makes it a repeatable gate.

**Do NOT** create `src/lib/seo/jsonld.ts` or duplicate any builder. The builders live in `schema.ts`; validate their output.

| # | Task | GATE |
|---|---|---|
| A1 | New script `scripts/validate/jsonld_check.py` (mirror `smoke_test.py`: `fetch_page`, parse every `<script type="application/ld+json">`, `json.loads`). Run against a sample: ≥10 facility URLs across ≥3 states, ≥10 hub URLs (city + county + state), the homepage. | Script exits 0; valid JSON in every block; every facility page has `LocalBusiness`+`MedicalOrganization` and a `BreadcrumbList`; every hub has `CollectionPage`+`ItemList`+`BreadcrumbList`. |
| A2 | In that script, assert the YMYL rule: a facility block contains `aggregateRating` **only if** that facility has published reviews. For a facility with no reviews, the key must be **absent** (never zero, never default). Pick sample facilities known to have 0 reviews. | Script asserts: review-less facility → no `aggregateRating`; reviewed facility → `aggregateRating.ratingCount` == real review count. |
| A3 | Cross-check 10 sampled facility URLs and 10 hub URLs against the schema.org Validator and Google Rich Results Test. | 0 errors on all sampled URLs. Paste the result list in the PR. |

**STOP conditions:** if any page emits a rating for an ungraded/review-less facility → that's a real YMYL bug; STOP, document it, do **not** patch `schema.ts` logic blindly. If the schema.org validator flags a structural error, report it for human review rather than restructuring a builder.

---

### Workstream B — Unit-test backfill for pure functions (SKIPPED this pass)

**Decision (2026-05-31):** skipped. There is no JS/TS test runner installed, and adding one (Vitest/Jest) is a net-new dependency + scaffolding decision rather than a clean/validate task. The live-page validation harness (`scripts/validate/`) plus the new audit scripts in Workstreams A/C/D/F already cover the safety surface that matters for this YMYL site. Unit tests can be added later as a deliberate, separate decision — nothing else in this plan depends on them.

**Do not** install a test runner or write `*.test.ts` files during this pass. If the model reaches B, skip to C.

---

### Workstream C — Internal linking: facility → parent hub (verify, backfill if absent)

**Why:** hub pages hold most impressions but rank low; every facility page should pass a signal up to its parent city/county. Presence is grep/audit-checkable.

| # | Task | GATE |
|---|---|---|
| C1 | New script `scripts/validate/internal_links_check.py`: fetch a sample of facility pages; assert each contains exactly one canonical parent-city link (and a county link where a county hub exists), built via `canonicalFor()`. | Script exits 0: 100% of sampled facility pages have the parent-city link. |
| C2 | **If C1 finds the link already present** (likely — confirm in the facility component first), C is a pure validation PR: ship the audit script, no component change. **If absent**, add one reused parent-link block in the facility component from route params/fields only. | Build green; C1 green. |
| C3 | Reciprocal: on hub pages, assert each ItemList row links **down** to its facility page. | Script: 0 hub rows without a facility link. |
| C4 | "Nearby cities" cross-links **only if** a deterministic adjacency list already exists in the repo (check `src/lib/regions*.ts`, `regionsCountyLookup.ts`). If none exists, **STOP** — do not infer geography. | Links render from the existing list, or a STOP note. |

**STOP conditions:** links only — do not write hub body copy (reserved). Do not invent city adjacency.

---

### Workstream D — Title / meta validation (verify, don't rebuild)

**Why:** the templates already exist in `meta.ts` with YMYL guards. This workstream proves length, uniqueness, and claim-safety as a repeatable gate, and flags one known discrepancy.

| # | Task | GATE |
|---|---|---|
| D1 | New script `scripts/validate/meta_check.py`: fetch a sample across all page types; assert 0 `<title>` > 60 chars, 0 `<meta name="description">` > 160 chars. | Script exits 0. |
| D2 | Assert no meta contains a quality/superlative claim token (`top-rated`, `best`, `0 violations`, `#1`) **unless** that claim is data-backed (i.e. the page's facility is top-half per snapshot, which `buildFacilitySnippet` already gates). | Script exits 0; flags any unsupported claim with its URL. |
| D3 | Uniqueness across sampled routes: 0 duplicate titles, 0 duplicate metas (within a page type). | Script exits 0. |
| D4 | **Flag, do not fix:** `clipMetaDescription` defaults to `max = 160`, but the older brief targeted ≤155. Note the discrepancy in the PR for a human to decide which limit is canonical. | One-line note in PR. No logic change. |

**STOP conditions:** any superlative claim not backed by a real data field is a YMYL bug — report it, do not silently strip it from `meta.ts` logic (that's an edit to do-not-touch logic; report instead).

---

### Workstream E — Accessibility & alt-text pass (mechanical)

**Why:** real code-health win, fully mechanical, lint/axe-gated.

| # | Task | GATE |
|---|---|---|
| E1 | Add descriptive `alt` to every `<img>`/`next/image` from adjacent field data (facility name, city). Decorative images → `alt=""`. | `npm run lint` green; axe scan: 0 missing-alt on 10 sampled pages across page types. |
| E2 | Add `aria-label` to icon-only links/buttons so every interactive element has an accessible name. | axe: 0 "button/link has no name" on samples. |

**STOP condition:** if a fix requires restructuring a component (more than a few lines, mixed concerns) → note it, don't refactor.

---

### Workstream F — Soft-404 + sitemap detection (read-only report)

**Why:** indexed hubs that render "Facility/Region not found" or an empty ItemList while still `index`-able leak crawl budget and rank for nothing. This workstream **finds** them; the populate-vs-`noindex` decision is a human call (out of scope).

| # | Task | GATE |
|---|---|---|
| F1 | New script `scripts/validate/soft404_report.py`: enumerate routes from the generated sitemaps; flag any page rendering a not-found / empty-ItemList state while still indexable. Write `docs/audits/soft404-report.md`. | Report file exists, lists offenders (confirm known ones e.g. `california/alameda-county`, `oregon/sweet-home`) + any others. **No fixes applied.** |
| F2 | New script `scripts/validate/sitemap_diff.py`: diff the four sitemap routes against actual routable pages; report orphans (routable but unlisted) + missing (listed but not routable). Write `docs/audits/sitemap-diff.md`. | Report file exists. |

**STOP condition:** do **not** `noindex`, delete, or "fix" any page. Report only.

---

### Workstream G — Page-by-page manual content QA (the core ask: errors & bad content)

**Why:** automated audits (A–F) catch structural issues; this workstream is the **human-style read-through** that catches placeholder text, wrong copy, fabricated claims, broken states, and "this page is just wrong" problems a script won't see. It is read-only reporting plus *mechanical* fixes only; anything requiring judgment is logged for a human.

**Scope is made tractable by tiering** (850+ facility pages can't each be read by hand):
- **Tier 1 — every unique static/editorial + template page, one by one.** All `src/app/**/page.tsx` that are *not* the dynamic `[state]/[city]/[facility]` leaf: the ~50 static pages (library, research, washington/oregon/texas/minnesota guides, methodology, about, reports, etc.) plus one representative render of each dynamic template (one facility, one city hub, one county hub, one state hub, one `/facilities` browse).
- **Tier 2 — sampled dynamic pages.** A fixed sample of facility + hub pages per publishable state (CA, OR, WA, MN, TX), reviewed by hand.
- **Tier 3 — all dynamic pages, mechanically.** Covered by the A–F audit scripts (already enumerate the full set).

| # | Task | GATE |
|---|---|---|
| G1 | Create `docs/audits/page-qa/` and a checklist template `_TEMPLATE.md` with the per-page checks below. | Folder + template exist. |
| G2 | **Tier 1:** review each unique page against the checklist; write one findings file per page (or one table covering all). Apply **mechanical** fixes inline (typos, missing alt, an obviously dead internal link) on the WS-G branch. Log every **judgment** issue (questionable copy, possibly-stale stat, layout/UX concern) as `NEEDS-HUMAN` — do not fix. | `docs/audits/page-qa/tier1.md` with pass/fail per check per page; mechanical fixes committed; `NEEDS-HUMAN` list populated. |
| G3 | **Tier 2:** same checklist against the per-state sample. | `docs/audits/page-qa/tier2-sample.md`. |
| G4 | Roll up all `NEEDS-HUMAN` items into `docs/audits/page-qa/NEEDS-HUMAN.md` (one line each: URL + issue + why it needs judgment). | Roll-up file exists. |

**Per-page checklist (each is pass/fail):**
1. Page renders with no runtime/console error and HTTP 200.
2. No not-found / empty-state body while the page is `index`-able (cross-ref F1).
3. No placeholder/dev content: `lorem`, `TODO`, `FIXME`, `xxx`, `mock`, `placeholder`, `Coming soon`, `undefined`, `NaN`, `[object Object]`, empty `{}` interpolations.
4. No fabricated/ungrounded numbers or superlatives (no rating/percentile/"best"/"top-rated"/"0 violations" not backed by data — YMYL).
5. All internal links resolve (no 404; cross-ref C/F2).
6. Every image has a sensible `alt` (cross-ref E).
7. `<title>` ≤ 60, meta description present and ≤ limit (cross-ref D).
8. `alternates.canonical` is set via `canonicalFor()` (AGENTS.md SEO checklist).
9. Required JSON-LD present for the page type (cross-ref A).
10. Copy is factually coherent (state names, regulator abbreviations via `REGULATOR_ABBR`, city/county names match the route).

**STOP conditions:** mechanical fixes only. Anything that changes meaning, makes a data claim, rewrites editorial copy, or changes grade/rating/severity logic → `NEEDS-HUMAN`, do not touch. Do not modify `schema.ts`/`meta.ts` logic.

---

### Workstream H — TSDoc on exported functions (optional filler)

Lowest value, lowest risk. Add TSDoc comments to exported functions/components in `src/lib` and `src/components` that lack them. No logic changes. **GATE:** `npx tsc --noEmit` green + `npm run lint` green. Use only if A–G are done and budget remains.

---

## Per-PR definition of done

Every PR must show, in its description:
- The workstream + tasks it closes.
- **Pasted output** of `npm run build` (green) and `npx tsc --noEmit` (green).
- The task-specific gate output (validator result list, audit-script exit + summary, or the audit `.md` artifact path).
- Confirmation it touched **nothing** on the do-not-touch list.
- For A / C / D / G: a one-line note that no rating/claim was synthesized for ungraded or review-less facilities.

Keep PRs small. Split A, C, and G by state or page-type if they grow (e.g. `chore/ws-g-qa-tier1`, `chore/ws-g-qa-tier2-ca`). Reviewable beats complete.

---

## Out of scope for this pass (requires editorial / strategic judgment — reserve for a human)

These need judgment, and on a YMYL site "wrong" can mean fabricated care data or a strategic miss:
- **Hub page editorial content** — the actual "best memory care in {city}, ranked by inspection record" copy and comparison UI. This is writing, not templating.
- **The conversion event** — shortlist / save-compare / email-the-report UX and flow.
- **The populate-vs-`noindex` decision** on the soft-404 hubs F1 surfaces.
- **Anything touching grade / rating / severity logic**, or any new migration.
- **Channel strategy** — Reddit / GEO / editorial voice.
- **Adding a test runner** (Workstream B) until explicitly approved.

---

*Plan — May 31 2026. Supersedes the framing of `CURSOR_BRIEF_bulk-token-burn_2026-05-31.md`; preserves its gates and YMYL fences, removes the build-from-scratch tasks that this codebase has already implemented, and adds the page-by-page content QA layer (Workstream G).*

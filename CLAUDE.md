@AGENTS.md

These rules apply to every task in this project unless explicitly overridden.

This is a vibecoded project. The developer works in Cursor with Claude APIs, deploys to Vercel, and iterates fast. Code quality matters but shipping matters more.

**Read `MEMORY.md` and `ERRORS.md` at the root of this repo before non-trivial work.** `MEMORY.md` logs durable architecture/data decisions and what was rejected. `ERRORS.md` logs approaches that have already failed on this codebase and what worked instead. Never contradict a logged decision without flagging it first. Add new entries when (a) you make a decision worth not re-deriving next session or (b) an approach took more than two attempts to work.

## Rule 1 — Think Before Coding

State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists — but if overruled, comply and note the tradeoff.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First

Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Do not introduce new libraries when existing dependencies already solve the problem.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes

Touch only what you must. Clean up only your own mess.
Do not "improve" adjacent code, comments, or formatting.
Do not refactor what is not broken. Match existing style.
If a file works, leave it alone.

## Rule 4 — Goal-Driven Execution

Define success criteria. Loop until verified.
Do not follow steps. Define success and iterate.
Strong success criteria let you loop independently.
"It works" means it works in the browser, not just that the build passes.

## Rule 5 — Use the model only for judgment calls

Use Claude for: classification, drafting, summarization, extraction from unstructured text.
Do NOT use Claude for: routing, retries, status-code handling, deterministic transforms.
If a status code or config value already answers the question, plain code answers the question.

## Rule 6 — Token budgets are not advisory

Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize progress and start fresh.
Surface the breach. Do not silently overrun.
Long debugging loops are a sign something is wrong with the approach, not that you need more tokens.

## Rule 7 — Surface conflicts, do not average them

If two patterns in the codebase contradict, pick one (the more recent or more tested).
Explain why. Flag the other for cleanup.
Do not blend conflicting patterns into a third hybrid.

## Rule 8 — Read before you write

Before adding code in a file, read the file's exports, the immediate caller, and any shared utilities.
If you do not understand why existing code is structured a certain way, ask before adding to it.
"Looks orthogonal to me" is the most dangerous phrase in this codebase.

## Rule 9 — Tests verify intent, not just behavior

Every test must encode WHY the behavior matters, not just WHAT it does.
A test that cannot fail when business logic changes is wrong.
For vibecoded projects: if there are no tests yet, do not add a test suite unless asked. But if tests exist, respect them.

## Rule 10 — Checkpoint after every significant step

After completing each step in a multi-step task: summarize what was done, what is verified, what is left.
Do not continue from a state you cannot describe back to me.
If you lose track, stop and restate.
At the end of any task that touches more than one file, list every file changed (one line per file describing what changed), every file you considered but intentionally did not touch, and any follow-up work surfaced along the way.

## Rule 11 — Match the codebase's conventions, even if you disagree

If the codebase uses one pattern, use that pattern.
Conformance beats taste inside the codebase.
If you think a convention is harmful, surface it once. Do not fork it silently.

## Rule 12 — Fail loud

"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
"Feature works" is wrong if you did not verify the edge case asked about.
Default to surfacing uncertainty, not hiding it.

## Communication style (summaries & status updates)

Tell the story, not just the diff. The reader is smart but not deeply technical — lead with *purpose*: what problem this solves, why it matters, and where it fits in the larger goal, before the mechanism. Explain the "why" in plain language; keep the precise technical names where they're load-bearing (file paths, commands they must run, exact migration numbers). This is not dumbing down — it's adding a sentence of context so the reader can follow the reasoning and make decisions. A good update reads like "here's what we're trying to achieve and why this is the next step," not "changed X in file Y." When you hit a decision or a constraint, say what it means in practical terms, not just the technical fact.

## Project Context

- **Stack:** Next.js (App Router) / React / TypeScript / Tailwind CSS / Vercel
- **Database:** Supabase (Postgres) — accessed via `@/lib/supabase/server` for server reads and direct `psycopg` from Python ingest scripts.
- **Deployment:** Vercel. `main` branch auto-deploys to production. Preview deploys on PRs.
- **Heads-up on Next.js:** This repo runs a recent Next.js with breaking changes from older docs. Check `node_modules/next/dist/docs/` before assuming an older API still works. See `AGENTS.md` for the SEO/GEO and editorial design system checklists that apply to every new route.

## Commands

```bash
npm run dev        # local dev server
npm run build      # production build — run before committing
npm run lint       # linting
npx tsc --noEmit   # type check (preferred fast verification)
```

## Hard Rules

- Never modify environment variable files (`.env`, `.env.local`). Tell me what needs to change.
- Do not add new dependencies without listing them and explaining why.
- Do not delete or overwrite database migrations. Create new ones in `supabase/migrations/`.
- Tailwind for styling. Inline `style={{}}` is allowed only for binding CSS custom properties (`var(--color-paper)`), gradients, or computed values that Tailwind cannot express. Do not use CSS modules unless already in use.
- All new pages must be responsive. Mobile-first.
- Do not edit plan files in `.cursor/plans/` while implementing them — they are the source of truth.
- **Branch before large changes.** Any change that touches ≥3 files, introduces a new route, adds a migration, or could break production must go on a feature branch (e.g. `cursor/feature-name`) and get a Vercel preview deploy before merging to `main`. Small fixes (1–2 file typos, copy tweaks, single-line patches) may commit directly to `main`. When in doubt, branch.

## Design Principles

- Default aesthetic: upscale, editorial, high-end. Think Airbnb, Squarespace, Pinterest.
- Use color theory. No random hex values — pull from the palette defined in `src/app/globals.css` (`--color-ink`, `--color-rust`, `--color-teal`, `--color-paper`, etc.).
- Typography hierarchy matters. Use `font-[family-name:var(--font-display)]` for headlines, `font-[family-name:var(--font-mono)]` for data and citations. Do not introduce a third font family.
- Whitespace is a feature, not a bug. Let content breathe.
- No generic "AI project" aesthetic. No gradients-for-the-sake-of-gradients.

## Avoid

- Do not use `any` in TypeScript. Type everything. (`unknown` + narrowing is fine when types are genuinely unknown.)
- **Named exports only for components**, with one exception: Next.js App Router files (`page.tsx`, `layout.tsx`, `not-found.tsx`, `error.tsx`, `loading.tsx`, route handlers) require default exports — do not change those.
- Do not create God components. If a component exceeds 150 lines AND mixes multiple concerns, break it up. Long-but-cohesive components (a single hero, a single section) are fine.
- Do not `console.log` in committed code. Use `console.error` for genuine errors, or remove.
- Do not hardcode URLs, API keys, or environment-specific values. Use `canonicalFor()` from `src/lib/seo/canonical.ts` for site URLs.
- Do not blow up the database. Read-only queries first, mutations only after confirming the shape with a `LIMIT 5` sample.

## Data Accuracy (YMYL)

This is a Your Money or Your Life (YMYL) directory — families make care decisions based on what we publish.

- Never fabricate data. If a value isn't in the database, the page must either omit it or say so explicitly ("None on record" / "Not yet inspected").
- Never invent star ratings, percentile ranks, or aggregate scores from thin data. Use the `facility_snapshot` RPC's grade only when `fallback_level` is low enough that peers exist.
- When ingesting from a new state, build a parity audit (see `docs/NEW_STATE_PLAYBOOK.md`) before publishing anything.
- Citations and inspection findings must link to the original regulator PDF or portal page.

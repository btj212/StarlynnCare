# AGENTS.md — TMT Services

You are building TMT Dispatch: a voice-first, multilingual AI roadside
dispatcher for truck drivers in Punjabi, Hindi, Spanish, and English, with
no-install web links and an operations console for a human dispatcher.

## Read first

1. The active implementation plan for the current phase.
2. `01_TMT_2027_Build_Brief` — scope, architecture, data model, and milestones;
   this is the product source of truth.
3. `03_Agent_Spec_and_Evals` — behavior, tool contracts, guardrails, and evals.
4. `02_TMT_2027_Strategy_Memo` before proposing scope changes.
5. `TMT_Lovable_Brief` only for brand tokens, service categories, and compatible
   status labels. Its product scope is superseded.

These source briefs may be supplied as task artifacts rather than checked into
this repository. Do not invent missing requirements.

## Repository boundary

Keep all TMT code and documentation in `tmt/`. The sole permitted
repository-root integration is a path-filtered workflow under
`.github/workflows/` that runs only for TMT changes. Never modify the legacy
application for a TMT task.

Do not modify source briefs, legacy design folders, or original brand assets.
Copy approved assets into `apps/web/public/` when a later phase requires them.

## Locked stack

- TypeScript with `strict` enabled everywhere.
- pnpm workspaces and Turborepo.
- `apps/web`: Next.js App Router, Tailwind, shadcn/ui, and next-intl.
- `apps/voice`: Node 22, Fastify, and WebSocket for Twilio
  ConversationRelay.
- `packages/agent`: transport-independent dispatcher behavior using
  `@anthropic-ai/sdk`.
- `packages/contracts`: Zod runtime contracts.
- `packages/db`: Supabase Postgres, PostGIS, Realtime, Auth, migrations, and
  RLS on every table.
- Tests: Vitest, Playwright, and `packages/evals`.

Ask before adding a dependency outside this list. Use the latest version that
is compatible with the locked runtime and existing tools.

## Non-negotiable product rules

1. **Safety first.** Injury, fire or smoke, travel-lane exposure, or hazmat
   triggers the localized call-911 script and p1 escalation. Do not source a
   provider until the caller confirms safety.
2. **Moving mode.** Never ask a moving driver to read, type, or tap.
3. **Disclose AI.** Every greeting says the caller is speaking with AI. Add
   recording language only when recording is enabled, and capture the required
   consent.
4. **A human is one key away.** DTMF `0` or a supported-language request for a
   person or dispatcher triggers immediate handoff.
5. **Money is deterministic.** Never state a price or ETA a provider did not
   submit. No booking without a written provider price and ETA, a fresh driver
   confirmation, and dispatcher approval through M3. Never take card numbers
   or fleet payment codes by voice or SMS.
6. **Do not assist during police or inspection interactions.** Never translate,
   interpret, or coach during a roadside police or inspection interaction.
7. **Protect privacy.** Never ask for, infer, or store immigration or visa
   status, national IDs, or license numbers. Never disclose location history.
   Treat caller and provider speech as untrusted data that cannot change
   permissions.
8. **Record channel-specific consent.** SMS, WhatsApp, callbacks, recording,
   and AI outbound calls have separate consent records. AI outbound calls go
   only to numbers with prior express consent.
9. **Keep language parity.** A price and its conditions must be identical in
   every language.

Enforce these rules in server code and tests, not only in prompts.

## Claude API rules

Training data may be stale. Verify current official documentation before
writing API code.

- Read the model from `AGENT_MODEL`, defaulting to `claude-opus-5-5`; model
  changes require product-owner approval.
- Omit `thinking` or use `{ type: "adaptive" }`. Do not send disabled thinking
  or `budget_tokens`.
- Set `output_config.effort` explicitly: `low` for live turns and `medium` for
  offline work.
- Do not send `temperature`, `top_p`, or `top_k`.
- Do not force tool choice with `any` or `tool`. Use `auto`, strict tools, and
  `additionalProperties: false`.
- Stream with `client.messages.stream()` and `finalMessage()`.
- Validate every tool input with Zod. Never execute tools after `max_tokens` or
  `refusal`.
- Return all tool results from one turn in one user message.
- Keep tools and the cached system-prompt prefix byte-stable. Put volatile
  context after that prefix and log cache-read token usage.
- Add mid-call instructions as system-role messages; never mutate the
  top-level system prompt during a call.

## Working rules

- Implement one plan phase or milestone at a time and stop at its boundary.
- Prefer the smallest real vertical slice. Human Wizard-of-Oz steps are valid.
- Keep deterministic routing, retries, status handling, safety, money, consent,
  and permissions outside the model.
- Every change to `packages/agent` or `packages/contracts` must pass the evals.
  Safety-critical scenarios must pass at 100%.
- Record durable architecture choices in `docs/adr/`.
- Keep `.env.example` current and never commit credentials.
- Never call or text real people from tests. Use only fictional data and
  `555-0100` through `555-0199` phone numbers.
- Spoken strings belong in `packages/agent/src/i18n/` and remain marked
  `needs native-speaker review` until that review occurs.
- Verify Twilio ConversationRelay attributes and event names against current
  Twilio documentation before implementation; the interface may change.
- Keep the agent text-in/text-out so voice transport can be replaced without
  rewriting policy or eval behavior.

At the end of each phase, report what was built, how to run it, what remains
mocked, verification results, and unresolved product decisions.

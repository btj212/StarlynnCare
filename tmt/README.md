# TMT

TMT Dispatch is a voice-first, multilingual roadside-dispatch product for truck
drivers. This directory is an isolated pnpm/Turborepo workspace inside the
larger repository; the legacy application outside `tmt/` is not a dependency
and must not be modified for TMT work.

## Current scope

This checkout contains the complete M0 foundation (phases 1 through 5):
workspace configuration,
architecture decisions, the M0 Supabase call/transcript/consent/handoff data
layer, strict shared runtime contracts, fictional repeatable seed data,
path-filtered CI, the localized Next.js web surface, and the Fastify
ConversationRelay voice loop with deterministic M0 acknowledgement and human
handoff. It also includes source-based safety scenario fixtures, a mock-only
eval runner, and Chromium E2E coverage for localization, fixture auth, the
operations board, and the under-two-second transcript update contract.

M0 makes no Anthropic calls. Model-backed simulated callers, rubric judges,
dispatch decisions, production calling, messaging, booking, and payment remain
intentionally deferred.

The web app contacts Supabase only when its public URL and anon key are
configured. No current script contacts Anthropic, Twilio, Google, Stripe, or
Sentry. Automated web tests use local fictional fixtures and make no network
calls.

## Prerequisites

- Node.js 22 LTS (`>=22.13.0 <23`)
- pnpm 12 (`>=12.16.1 <13`), normally enabled with Corepack

```bash
corepack enable
corepack prepare pnpm@12.16.1 --activate
```

## Install and verify

Run all commands from this directory:

```bash
pnpm install --frozen-lockfile
pnpm --filter @tmt/web exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Turborepo runs each command in all six workspaces. `pnpm test` runs unit,
integration, mock safety eval, and Chromium E2E suites. Build output is written
to ignored `dist/` and framework output directories.

## Workspace map

| Workspace | Responsibility |
| --- | --- |
| `apps/web` | Next.js App Router landing, magic-link auth, and live operations board |
| `apps/voice` | Long-lived Fastify/ConversationRelay voice service |
| `packages/contracts` | Runtime schemas and shared TypeScript contracts |
| `packages/db` | Supabase migrations, RLS, seed data, and generated types |
| `packages/agent` | Transport-independent dispatcher behavior and policies |
| `packages/evals` | YAML safety scenarios and deterministic mock-only evaluation harness |

Architecture decisions are under `docs/adr/`. Rules for agents and
contributors are in `AGENTS.md`.

## Environment setup

Copy the example locally and fill only the values needed by the phase you are
working on:

```bash
cp .env.example .env.local
```

Environment files are ignored; `.env.example` is the only environment file
that belongs in Git. Never put a service-role key, API key, auth token, or
phone number in source, fixtures, logs, screenshots, or commits.

Browser code may receive only values explicitly intended for a browser.
`SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`,
`STRIPE_SECRET_KEY`, and `ANTHROPIC_API_KEY` are server-only.

### Web app

Set `PUBLIC_WEB_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, then run:

```bash
pnpm --filter @tmt/web dev
```

The root redirects to the English locale. Public and authenticated routes are
locale-prefixed (`/en`, `/pa`, `/hi`, `/es`); `/ops` therefore resolves to
`/en/ops`. Supabase Auth must allow the app's
`/auth/callback` URL. Only existing Auth users with a `profiles` row whose
role is `dispatcher` or `admin` can open the operations board.

For automated tests only, `TMT_WEB_FIXTURE_MODE=test` supplies fictional
operations data and bypasses Auth. Any other non-empty value fails, and fixture
mode is refused when `NODE_ENV=production`. Never configure this variable in
Vercel preview or production environments.

The fixture login form redirects to the fictional authenticated board without
sending email. The board injects
one deterministic transcript event after 150 ms so E2E can verify the realtime
render contract without Supabase or another network service.

The operations board reads `calls`, `utterances`, `consents`,
`handoff_events`, and `escalations` through the signed-in user's anon-key
client and RLS, then subscribes to the same tables through Supabase Realtime.
It never imports or exposes the service-role key.

### Brand asset gate

The supplied directory contained no approved logo or image files. This phase
therefore uses an accessible text-only `TMT Services` mark and does not invent
a graphic logo. `apps/web/public/brand` remains intentionally absent. Before a
graphic mark ships, the product owner must supply and approve the source asset;
copy it into that directory without redrawing or synthesizing it.

### Voice service

Set the server-only Supabase and Twilio variables, all four inbound numbers,
`ON_CALL_FALLBACK_E164`, and an HTTPS `PUBLIC_VOICE_BASE_URL`. Then run:

```bash
pnpm --filter @tmt/contracts build
pnpm --filter @tmt/db build
pnpm --filter @tmt/agent build
pnpm --filter @tmt/voice dev
```

Configure the Twilio number voice webhook as
`POST {PUBLIC_VOICE_BASE_URL}/twilio/voice`. The generated TwiML connects to
`wss://…/relay` and posts ConversationRelay completion/handoff events to
`/twilio/handoff`. Both HTTP callbacks reject requests whose
`X-Twilio-Signature` does not match the exact public URL and form body.

The service role key is used only by this Node service. Never expose it through
`NEXT_PUBLIC_*` or browser code. `RECORDING_ENABLED` defaults to false; setting
it to true changes the spoken disclosure but does not itself configure a
Twilio recording product.

## Local-service setup

These steps apply only after the corresponding implementation phase lands:

1. Follow `packages/db/README.md` to reset local Supabase, apply migrations and
   fictional seeds, run pgTAP RLS checks, and regenerate database types.
2. Start `apps/web` and `apps/voice` with their development scripts.
3. Expose `apps/voice` through cloudflared or ngrok for Twilio test webhooks.
4. Point only a Twilio test number at the tunnel and validate every webhook
   signature.

Do not make real calls, send real messages, enable recording, or use production
credentials during automated tests. Test phone data must use the fictional
`555-0100` through `555-0199` range.

`packages/evals/scenarios/*.yaml` is derived from the named initial cases in
the agent specification. Its runner uses fixed outputs and production greeting
copy only. It has no model client, provider credentials, retry loop, or network
adapter.

## Safety and launch gates

- Every greeting identifies the dispatcher as AI.
- Recording stays off unless `RECORDING_ENABLED=true`; when enabled, recording
  language and consent handling are mandatory.
- DTMF `0` and supported spoken requests for a person immediately enter the
  human-handoff path.
- Safety, money, consent, privacy, and handoff permissions are deterministic
  server rules, never model decisions.
- No anonymous client may read operational records. Supabase RLS is required
  on every table.
- Live messaging requires A2P 10DLC registration or toll-free verification.
- Live voice/recording requires owned test numbers, ConversationRelay access,
  counsel review, and native-speaker review of Punjabi, Hindi, and Spanish
  scripts.
- TMT CI applies the migration and seed twice against a Docker-backed,
  database-only local Supabase stack and runs the pgTAP deny/allow suite after
  each reset. A local Docker-backed stack is required to reproduce that gate.
- Punjabi STT/TTS must pass a native-speaker roadside-noise bake-off before a
  production voice is selected.
- The current Twilio SDK emits the documented ConversationRelay TwiML and
  message forms. Live verification remains gated on Twilio ConversationRelay
  account onboarding and owned test numbers; automated tests make no calls.

See the accepted ADRs for the constraints later phases must preserve.

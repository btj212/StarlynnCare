# Facility Watch welcome — Loops setup

## Variable syntax (important)

Loops uses **single braces**, not `{{double}}`.

| Editor mode | Syntax | Example |
|-------------|--------|---------|
| **Plain / Styled** | `{variableName}` | `{facilityName}` |
| **Code / MJML** | `{DATA_VARIABLE:variableName}` | `{DATA_VARIABLE:facilityName}` |
| **Subject line** | `{variableName}` | `You're watching {facilityName}` |

Our API (`src/lib/email/watch.ts`) sends these `dataVariables` keys — names must match exactly:

`facilityName`, `facilityUrl`, `cityState`, `licenseNumber`, `recordSummary`,
`lastActivityDate`, `lastActivityType`, `quietPeriodLine`, `recentEventsText`,
`statsLine`, `severityRankLine`, `whatWeWatch`, `unsubscribeUrl`

(`licenseNumber` is sent but not shown in the MJML body — safe to omit from template or add later.)

## Option A — Code tab (MJML zip upload)

1. Upload `watch-welcome-loops.zip` — Loops requires the MJML file inside to be named **`index.mjml`** exactly (not `watch-welcome.mjml`). The repo zip is pre-built; to rebuild:
   ```bash
   cd src/lib/email/templates
   cp watch-welcome.mjml index.mjml
   zip -j watch-welcome-loops.zip index.mjml
   ```
2. Loops → Transactional → your email → **Code** tab → upload `watch-welcome-loops.zip`
3. Subject: `You're watching {facilityName}`
4. Publish → copy Transactional ID → Vercel `LOOPS_WATCH_WELCOME_ID`

## Option B — Plain text tab

1. Loops → Transactional → **Plain** tab
2. Write copy using `{facilityName}`, `{recordSummary}`, etc. (no HTML)
3. Good for a fast smoke test; use MJML for the designed digest

## Do not

- Paste raw HTML into the Styled block editor (renders as escaped tags — see `ERRORS.md`)
- Use `{{facilityName}}` (Loops will not substitute)
- Reuse `LOOPS_WATCH_CONFIRM_ID` from the old confirm-click flow

## Test

1. Send test from Loops UI with sample data
2. Sign up on a facility profile on production
3. Confirm rendered email (not raw HTML tags)

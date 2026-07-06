# Loops email templates — setup & status

This project sends transactional emails through Loops. There are **two families** of
emails, and they are easy to confuse:

- **Facility-specific emails** — fire when someone acts on a *specific facility*
  (watches it, requests its records, requests a tour pack). Personalized with that
  facility's name and citations. **These are already live.**
- **Library magnet emails** — fire when someone submits their email on a *library
  article* (the editorial guides). Facility-agnostic; the content is a self-contained
  checklist or guide. **These are new and not yet set up.**

> The word "tour" appears in both families. Your existing **tour prep pack**
> (`LOOPS_TOUR_EMAIL_ID`, facility-specific) is a *different email* from the new
> **tour scoresheet** magnet (`LOOPS_MAGNET_SCORESHEET_ID`, a blank printable from
> the 37-questions article). Setting up one does not cover the other.

---

## Status at a glance

| Email | Env var | Fires from | Status |
|---|---|---|---|
| Watch welcome | `LOOPS_WATCH_WELCOME_ID` | Facility profile — "watch this facility" | ✅ Live |
| Records delivery | `LOOPS_RECORDS_EMAIL_ID` | Facility profile — "get the full record" | ✅ Live |
| Tour prep pack | `LOOPS_TOUR_EMAIL_ID` | Facility profile — "get a tour-prep pack" | ✅ Live |
| Contract ack | `LOOPS_CONTRACT_EMAIL_ID` | `/tools/contract-review` + Contract Decoder CTAs | ✅ Live |
| Crisis checklist | `LOOPS_MAGNET_CRISIS_ID` | `/library/the-first-72-hours` | ⬜ To set up |
| Readiness guide | `LOOPS_MAGNET_READINESS_ID` | `/library/when-is-it-time-for-memory-care` | ⬜ To set up |
| 90-day roadmap | `LOOPS_MAGNET_ROADMAP_ID` | `/library/dementia-vs-alzheimers-vs-lewy-body` | ⬜ To set up |
| Red flags cheat sheet | `LOOPS_MAGNET_REDFLAGS_ID` | `/library/type-a-vs-type-b-deficiencies-explained` | ⬜ To set up |
| Tour scoresheet | `LOOPS_MAGNET_SCORESHEET_ID` | `/library/37-questions-to-ask-on-a-memory-care-tour` | ⬜ To set up |
| Medi-Cal / ALW checklist | `LOOPS_MAGNET_ALW_ID` | `/library/medi-cal-and-memory-care` | ⬜ To set up |

**What this means right now:** the 6 library magnet CTAs already capture the email
and create the Loops contact (userGroup `digest_subscriber`), but they send **no
checklist** until the matching env var is set — `sendMagnetEmail()` returns silently
when the ID is missing (see `src/lib/email/watch.ts`). So the "check your inbox"
promise on those articles is unfulfilled until you complete Part B below.

Exception: three library articles (medi-cal, memory-care-vs-nursing-home, 37-questions)
also carry a **Contract Decoder** CTA that routes to `/tools/contract-review` and uses
the already-live contract email — those specific CTAs work today.

---

## How to upload a template to Loops

The **Code tab** in Loops expects **MJML**, not plain HTML. Use the `.mjml`/`.zip`
files in this folder for Code tab uploads — never the `.html` files.

1. Loops → Transactional → Create → give it a name
2. Click the **Code** tab
3. Upload the template's `*-loops.zip` (each contains a single `index.mjml`)
4. Set the subject line, Publish → copy the template ID → add to Vercel env vars

> **If you paste a `.html` file into the Code tab, Loops shows "Body is missing"** —
> that's the "sender details validation → Missing fields → Body" error. It means
> Loops parsed the file as MJML and found no `<mj-body>`. Upload the `.zip` instead.
> The `.html` files here are human-readable references only.

### Variable syntax

| Editor mode | Syntax |
|---|---|
| Plain / Styled | `{variableName}` |
| Code / MJML | `{DATA_VARIABLE:variableName}` |
| Subject line | `{variableName}` |

Loops requires **single braces** — never `{{double}}`.

---

# Part A — Emails you already have live

You do not need to redo these. They are documented here so the whole system is in one
place and so you can tell them apart from the magnets in Part B.

## A1. Watch welcome (`LOOPS_WATCH_WELCOME_ID`) — ✅ live

Full setup notes: `LOOPS_WATCH_WELCOME_SETUP.md`. Zip: `watch-welcome-loops.zip`.

**Subject:** `You're watching {facilityName}`
**Fires from:** `/api/watch` (`sendWatchWelcome`) when a visitor watches a facility.
**Variables:** `facilityName`, `facilityUrl`, `cityState`, `licenseNumber`,
`recordSummary`, `lastActivityDate`, `lastActivityType`, `quietPeriodLine`,
`recentEventsText`, `statsLine`, `severityRankLine`, `whatWeWatch`, `unsubscribeUrl`.

## A2. Records delivery (`LOOPS_RECORDS_EMAIL_ID`) — ✅ live

**Zip:** `records-email-loops.zip`
**Subject:** `Your inspection record for {facilityName}`
**Fires from:** `/api/watch` (`sendRecordsEmail`) on the "get the full inspection record" offer.
**Variables:** `facilityName`, `facilityUrl`, `cityState`, `licenseNumber`, `recordSummary`,
`lastActivityDate`, `lastActivityType`, `quietPeriodLine`, `recentEventsText`,
`statsLine`, `severityRankLine`, `unsubscribeUrl`.

## A3. Tour prep pack (`LOOPS_TOUR_EMAIL_ID`) — ✅ live

**Zip:** `tour-email-loops.zip`
**Subject:** `Your tour checklist for {facilityName}`
**Fires from:** `/api/watch` (`sendTourEmail`) on the "get a tour-prep pack" offer on a
**facility profile**. Personalized with that facility's citations.
**Variables:** `facilityName`, `facilityUrl`, `cityState`, `tourChecklistText`,
`topCitedSummary`, `unsubscribeUrl`.

> Not to be confused with the **tour scoresheet** magnet (B5), which is a blank
> printable sent from the *library article*, with no facility data.

## A4. Contract acknowledgment (`LOOPS_CONTRACT_EMAIL_ID`) — ✅ live

**Zip:** `contract-ack-loops.zip`
**Subject:** `We got your request — here's how to send your contract`
**Fires from:** `/api/offer/contract` (`sendContractAck`) — the `/tools/contract-review`
page and the "Contract Decoder" CTAs on the medi-cal, memory-care-vs-nursing-home, and
37-questions articles.
**Variables:** `unsubscribeUrl`.

---

# Part B — New library magnet emails to set up

All six fire from `POST /api/watch/digest` (`sendMagnetEmail`) based on the `magnet`
field submitted by the library CTA. They send **no data variables** — every template is
fully self-contained. Only `{unsubscribeUrl}` is used, for the footer link.

Upload each `*-loops.zip`, set the subject, publish, then add the ID to Vercel
(Production **and** Preview).

### B1. Crisis checklist (`LOOPS_MAGNET_CRISIS_ID`)

**Zip:** `magnet-crisis-checklist-loops.zip`
**Subject:** `Your 72-hour placement checklist`
**Preview:** `The steps, in order — for when a hospital social worker says you have 72 hours.`
**Article:** `/library/the-first-72-hours` · magnet key `crisis_checklist`

### B2. Readiness guide (`LOOPS_MAGNET_READINESS_ID`)

**Zip:** `magnet-readiness-guide-loops.zip`
**Subject:** `The readiness signs — and how to talk about them`
**Preview:** `8 safety signals + a script for the sibling conversation.`
**Article:** `/library/when-is-it-time-for-memory-care` · magnet key `readiness_guide`

### B3. First 90 days roadmap (`LOOPS_MAGNET_ROADMAP_ID`)

**Zip:** `magnet-diagnosis-roadmap-loops.zip`
**Subject:** `The first 90 days after a dementia diagnosis — mapped`
**Preview:** `Weeks 1–4 safety & legal. Weeks 5–8 facility research. Weeks 9–12 narrow & decide.`
**Article:** `/library/dementia-vs-alzheimers-vs-lewy-body` · magnet key `diagnosis_roadmap`

### B4. Red flags cheat sheet (`LOOPS_MAGNET_REDFLAGS_ID`)

**Zip:** `magnet-redflags-cheatsheet-loops.zip`
**Subject:** `10 red flags in inspection reports — the cheat sheet`
**Preview:** `What experienced families watch for — and what to say when they find it.`
**Article:** `/library/type-a-vs-type-b-deficiencies-explained` · magnet key `redflags_cheatsheet`

### B5. Tour scoresheet (`LOOPS_MAGNET_SCORESHEET_ID`)

**Zip:** `magnet-tour-scoresheet-loops.zip`
**Subject:** `Your memory care tour scoresheet`
**Preview:** `Pull this up on your phone or print it. Take notes in the building.`
**Article:** `/library/37-questions-to-ask-on-a-memory-care-tour` · magnet key `tour_scoresheet`

### B6. Medi-Cal / ALW checklist (`LOOPS_MAGNET_ALW_ID`)

**Zip:** `magnet-alw-checklist-loops.zip`
**Subject:** `Your Medi-Cal / ALW memory care checklist`
**Preview:** `County participation, waitlist steps, SSI room-and-board rates, and the questions to ask.`
**Article:** `/library/medi-cal-and-memory-care` · magnet key `alw_checklist`

---

## Vercel env vars — new ones to add

Already set (leave alone): `LOOPS_WATCH_WELCOME_ID`, `LOOPS_RECORDS_EMAIL_ID`,
`LOOPS_TOUR_EMAIL_ID`, `LOOPS_CONTRACT_EMAIL_ID`.

Add these (Production **and** Preview):

- [ ] `LOOPS_MAGNET_CRISIS_ID`
- [ ] `LOOPS_MAGNET_SCORESHEET_ID`
- [ ] `LOOPS_MAGNET_ALW_ID`
- [ ] `LOOPS_MAGNET_READINESS_ID`
- [ ] `LOOPS_MAGNET_ROADMAP_ID`
- [ ] `LOOPS_MAGNET_REDFLAGS_ID`

**Suggested order:** start with `LOOPS_MAGNET_CRISIS_ID` and `LOOPS_MAGNET_SCORESHEET_ID`
— highest emotional intent and most immediate utility. Each magnet activates the moment
its env var is set; the others keep capturing contacts (no broken pages) in the meantime.

---

## Loops automations (facility-offer follow-ups — optional)

Applies to the Part A facility offers, not the magnets.

| Automation | Trigger condition | Wait | Subject |
|---|---|---|---|
| Watch follow-up | `userGroup = offer_watch` | +7 days | "Your watched facility — a quick update" |
| Records follow-up | `userGroup = offer_records` | +7 days | "Did the record answer your questions?" |
| Tour follow-up | `userGroup = offer_tour` | +3 days | "How did the tour go?" |
| Contract reminder | `userGroup = offer_contract` | +48 hours | "Still waiting on your contract PDF" |

All trigger on **Contact created or updated** → filter by `userGroup`.

Magnet signups land in `userGroup = digest_subscriber` with a `magnet` property, so you
can build magnet-specific nurture automations later if you want.

---

## Do not

- Paste raw HTML into the Code tab (upload the `.zip`) or into the Styled editor
  (renders as escaped tags).
- Use `{{facilityName}}` — Loops requires single braces.
- Reuse one transactional ID across templates — each needs its own.

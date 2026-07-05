# Offer email templates — Loops setup

## How to upload a template to Loops

The **Code tab** in Loops expects **MJML format**, not plain HTML. Use the `.mjml` files (not the `.html` files) for Code tab uploads:

1. Loops → Transactional → Create → give it a name
2. Click the **Code** tab
3. Create a zip containing **one file** named `index.mjml` (use the `.mjml` file from this folder)
4. Click "Select file" and upload the zip
5. Set the subject line, Publish → copy the template ID → add to Vercel env vars

> **If you paste the `.html` file into the Code tab, Loops shows "Body is missing"** — this is because Code tab expects MJML, not HTML. The `.mjml` files in this folder are the correct upload format.

## Variable syntax (same rule for all templates)


| Editor mode    | Syntax                         |
| -------------- | ------------------------------ |
| Plain / Styled | `{variableName}`               |
| Code / MJML    | `{DATA_VARIABLE:variableName}` |
| Subject line   | `{variableName}`               |


---

## Template 1: Records delivery (`LOOPS_RECORDS_EMAIL_ID`)

**Zip file:** `records-email-loops.zip`

**Subject:** `Your inspection record for {facilityName}`

**Variables sent by the API:**
`facilityName`, `facilityUrl`, `cityState`, `licenseNumber`, `recordSummary`,
`lastActivityDate`, `lastActivityType`, `quietPeriodLine`, `recentEventsText`,
`statsLine`, `severityRankLine`, `unsubscribeUrl`

**Steps:**

1. Loops → Transactional → Create → Code tab → upload `records-email-loops.zip`
2. Subject: `Your inspection record for {facilityName}`
3. Publish → copy ID → Vercel env var `LOOPS_RECORDS_EMAIL_ID`

---

## Template 2: Tour prep pack (`LOOPS_TOUR_EMAIL_ID`)

**Zip file:** `tour-email-loops.zip`

**Subject:** `Your tour checklist for {facilityName}`

**Variables sent by the API:**
`facilityName`, `facilityUrl`, `cityState`, `tourChecklistText`, `topCitedSummary`, `unsubscribeUrl`

**Steps:**

1. Loops → Transactional → Create → Code tab → upload `tour-email-loops.zip`
2. Subject: `Your tour checklist for {facilityName}`
3. Publish → copy ID → Vercel env var `LOOPS_TOUR_EMAIL_ID`

---

## Template 3: Contract acknowledgment (`LOOPS_CONTRACT_EMAIL_ID`)

**Zip file:** `contract-ack-loops.zip`

**Subject:** `We got your request — here's how to send your contract`

**Variables sent by the API:**
`unsubscribeUrl`

**Steps:**

1. Loops → Transactional → Create → Code tab → upload `contract-ack-loops.zip`
2. Subject: `We got your request — here's how to send your contract`
3. Publish → copy ID → Vercel env var `LOOPS_CONTRACT_EMAIL_ID`

---

## Vercel env vars checklist

Add all three to **Production** and **Preview** environments:

- [ ] `LOOPS_RECORDS_EMAIL_ID`
- [ ] `LOOPS_TOUR_EMAIL_ID`
- [ ] `LOOPS_CONTRACT_EMAIL_ID`

---

## Library email magnets (Templates 4–9)

These are sent when a visitor submits their email on a library article CTA.
The `magnet` field in the POST body determines which template fires.
All send via `POST /api/watch/digest` with `magnet: "<key>"`.

No variables are sent from the API — all content is embedded in the template.
Use `{unsubscribeUrl}` in your template for the unsubscribe link.

---

### Template 4: 72-hour crisis checklist (`LOOPS_MAGNET_CRISIS_ID`)

**HTML file:** `magnet-crisis-checklist.html`

**Subject:** `Your 72-hour placement checklist`

**Preview text:** `The steps, in order — for when a hospital social worker says you have 72 hours.`

**Steps:**

1. Loops → Transactional → Create → Code tab → paste HTML from `magnet-crisis-checklist.html`
2. Subject: `Your 72-hour placement checklist`
3. Publish → copy ID → Vercel env var `LOOPS_MAGNET_CRISIS_ID`

---

### Template 5: Readiness guide + family conversation script (`LOOPS_MAGNET_READINESS_ID`)

**HTML file:** `magnet-readiness-guide.html`

**Subject:** `The readiness signs — and how to talk about them`

**Preview text:** `8 safety signals + a script for the sibling conversation.`

**Steps:**

1. Loops → Transactional → Create → Code tab → paste HTML from `magnet-readiness-guide.html`
2. Subject: `The readiness signs — and how to talk about them`
3. Publish → copy ID → Vercel env var `LOOPS_MAGNET_READINESS_ID`

---

### Template 6: First 90 days diagnosis roadmap (`LOOPS_MAGNET_ROADMAP_ID`)

**HTML file:** `magnet-diagnosis-roadmap.html`

**Subject:** `The first 90 days after a dementia diagnosis — mapped`

**Preview text:** `Weeks 1–4 safety & legal. Weeks 5–8 facility research. Weeks 9–12 narrow & decide.`

**Steps:**

1. Loops → Transactional → Create → Code tab → paste HTML from `magnet-diagnosis-roadmap.html`
2. Subject: `The first 90 days after a dementia diagnosis — mapped`
3. Publish → copy ID → Vercel env var `LOOPS_MAGNET_ROADMAP_ID`

---

### Template 7: Red flags cheat sheet (`LOOPS_MAGNET_REDFLAGS_ID`)

**HTML file:** `magnet-redflags-cheatsheet.html`

**Subject:** `10 red flags in inspection reports — the cheat sheet`

**Preview text:** `What experienced families watch for — and what to say when they find it.`

**Steps:**

1. Loops → Transactional → Create → Code tab → paste HTML from `magnet-redflags-cheatsheet.html`
2. Subject: `10 red flags in inspection reports — the cheat sheet`
3. Publish → copy ID → Vercel env var `LOOPS_MAGNET_REDFLAGS_ID`

---

### Template 8: Tour scoresheet (`LOOPS_MAGNET_SCORESHEET_ID`)

**HTML file:** `magnet-tour-scoresheet.html`

**Subject:** `Your memory care tour scoresheet`

**Preview text:** `Pull this up on your phone or print it. Take notes in the building.`

**Steps:**

1. Loops → Transactional → Create → Code tab → paste HTML from `magnet-tour-scoresheet.html`
2. Subject: `Your memory care tour scoresheet`
3. Publish → copy ID → Vercel env var `LOOPS_MAGNET_SCORESHEET_ID`

---

### Template 9: Medi-Cal / ALW checklist (`LOOPS_MAGNET_ALW_ID`)

**HTML file:** `magnet-alw-checklist.html`

**Subject:** `Your Medi-Cal / ALW memory care checklist`

**Preview text:** `County participation, waitlist steps, SSI room-and-board rates, and the questions to ask.`

**Steps:**

1. Loops → Transactional → Create → Code tab → paste HTML from `magnet-alw-checklist.html`
2. Subject: `Your Medi-Cal / ALW memory care checklist`
3. Publish → copy ID → Vercel env var `LOOPS_MAGNET_ALW_ID`

---

## Vercel env vars checklist (full list)

Add all to **Production** and **Preview** environments:

- [ ] `LOOPS_RECORDS_EMAIL_ID`
- [ ] `LOOPS_TOUR_EMAIL_ID`
- [ ] `LOOPS_CONTRACT_EMAIL_ID`
- [ ] `LOOPS_MAGNET_CRISIS_ID`
- [ ] `LOOPS_MAGNET_READINESS_ID`
- [ ] `LOOPS_MAGNET_ROADMAP_ID`
- [ ] `LOOPS_MAGNET_REDFLAGS_ID`
- [ ] `LOOPS_MAGNET_SCORESHEET_ID`
- [ ] `LOOPS_MAGNET_ALW_ID`

**Priority order:** Start with `LOOPS_MAGNET_CRISIS_ID` and `LOOPS_MAGNET_SCORESHEET_ID` — highest emotional intent. All templates fall back silently to the Loops welcome automation until env vars are set, so the code is safe to deploy before templates are created.

---

## Loops automations (configure after templates are live)


| Automation        | Trigger condition            | Wait      | Subject                                  |
| ----------------- | ---------------------------- | --------- | ---------------------------------------- |
| Watch follow-up   | `userGroup = offer_watch`    | +7 days   | "Your watched facility — a quick update" |
| Records follow-up | `userGroup = offer_records`  | +7 days   | "Did the record answer your questions?"  |
| Tour follow-up    | `userGroup = offer_tour`     | +3 days   | "How did the tour go?"                   |
| Contract reminder | `userGroup = offer_contract` | +48 hours | "Still waiting on your contract PDF"     |


All four trigger on: **Contact created or updated** → filter by `userGroup` property.

---

## Do not

- Paste raw HTML into the Styled block editor (renders as escaped tags)
- Use `{{facilityName}}` — Loops requires single braces
- Reuse the watch welcome transactional ID for any of these


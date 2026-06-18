# Offer email templates — Loops setup

Same upload process as `LOOPS_WATCH_WELCOME_SETUP.md`. One zip per template.

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

- [x] `LOOPS_RECORDS_EMAIL_ID`
- [x] `LOOPS_TOUR_EMAIL_ID`
- [x] `LOOPS_CONTRACT_EMAIL_ID`

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


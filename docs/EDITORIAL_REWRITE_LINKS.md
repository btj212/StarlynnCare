# Editorial rewrite brief — CA moat pillars

Use this with live pages on **`https://www.starlynncare.com`**. Target depth for substantive rewrites: **1,500–2,500 words** of caregiver-facing prose (excluding nav/footers/JSON-LD).

**Word counts** below are `wc -w` on the page source file (`page.tsx`) — they **include** imports, JSX, and metadata strings. Treat as a **rough upper bound**; paste into a doc editor for true prose count.

---

## 1. Memory care vs. nursing home

| | |
| --- | --- |
| **URL** | https://www.starlynncare.com/library/memory-care-vs-nursing-home |
| **Source** | `src/app/library/memory-care-vs-nursing-home/page.tsx` |
| **`wc -w` (file)** | ~1,041 |
| **Plan target** | 1,500–2,500 words (prose) |

**What’s underweight (rewrite direction)**

- **CMS vs. CDSS:** Deeper contrast of nursing facility (Medicare/CMS survey universe) vs. RCFE memory care (California CDSS): what families see on Care Compare vs. what StarlynnCare shows from CCL.
- **Clinical thresholds:** When SNF is medically necessary vs. when assisted living / memory care is appropriate — without giving medical advice, cite typical triggers (skilled nursing, IVs, vent, etc.).
- **Payor reality:** Medicare Part A spell limits vs. long-stay Medicaid in SNF vs. private pay in RCFE — tie back to family expectations on discharge.

---

## 2. Medi-Cal & memory care

| | |
| --- | --- |
| **URL** | https://www.starlynncare.com/library/medi-cal-and-memory-care |
| **Source** | `src/app/library/medi-cal-and-memory-care/page.tsx` |
| **`wc -w` (file)** | ~747 |
| **Plan target** | 1,500–2,500 words (prose) |

**What’s underweight (rewrite direction)**

- **ALW mechanics:** County participation, waitlists, enrollment steps, and what “services” vs. room charges means in plain language (still no individualized eligibility advice).
- **Statutory framing:** Light-touch references to Medi-Cal long-term care programs and where ALW sits — enough for E-E-A-T without pretending to replace DHCS or legal counsel.
- **Share of cost / income:** Define SOC at a high level and why operators still quote private-pay rates.

---

## 3. Dementia vs. Alzheimer’s vs. Lewy body

| | |
| --- | --- |
| **URL** | https://www.starlynncare.com/library/dementia-vs-alzheimers-vs-lewy-body |
| **Source** | `src/app/library/dementia-vs-alzheimers-vs-lewy-body/page.tsx` |
| **`wc -w` (file)** | ~723 |
| **Plan target** | 1,500–2,500 words (prose) |

**What’s underweight (rewrite direction)**

- **Lewy body specifics:** Visual hallucinations, fluctuating cognition, REM sleep behavior — and how these affect **tour observations** and medication sensitivity conversations with providers.
- **Mixed pathology:** Short section on common overlap and why diagnosis affects care planning, not StarlynnCare grades.
- **Residential fit:** How symptoms map to staffing ratios / awake-night needs **as questions to ask**, not prescriptions.

---

## 4. When is it time for memory care?

| | |
| --- | --- |
| **URL** | https://www.starlynncare.com/library/when-is-it-time-for-memory-care |
| **Source** | `src/app/library/when-is-it-time-for-memory-care/page.tsx` |
| **`wc -w` (file)** | ~718 |
| **Plan target** | 1,500–2,500 words (prose) |

**What’s underweight (rewrite direction)**

- **Safety & capacity:** Wandering, burns, driving, medication errors — framed as decision prompts and ADL/IADL milestones (cite general geriatric assessment concepts, not diagnostic thresholds).
- **Caregiver burnout:** Respite, hospice overlap where relevant, and family dynamics without therapeutic claims.
- **Transition mechanics:** How tours change when urgency increases (records to bring, hospital discharge angles — high level).

---

## 5. Cost by city (California regional bands)

| | |
| --- | --- |
| **URL** | https://www.starlynncare.com/california/cost-by-city |
| **Source** | `src/app/california/cost-by-city/page.tsx` |
| **`wc -w` (file)** | ~734 |
| **Plan target** | 1,500–2,500 words (prose) |

**What’s underweight (rewrite direction)**

- **Method transparency:** How metro bands relate to Genworth / market benchmarks and why facility quotes still diverge (care levels, semi-private vs. private, community fees).
- **Geo narrative:** 1–2 sentences per major band on **why** markets differ (labor, land, supply) without fake precision.
- **Cross-links:** Deeper pointers to `/california/cost-guide` and payer pages so this isn’t an orphan money page.

---

## Rich Results / QA

After rewrites ship, run Google’s **Rich Results Test** on each URL above plus `/library` index once the hub is live in production.

# Illustration library — editorial assets

Internal watercolor-style illustrations for guides and hubs. **No stock photography of real residents** — preserves dignity and avoids likeness issues.

## Conventions

- **Style:** Textured editorial / storybook watercolor; cohesive with `/illustrations/family.png` (homepage hero).
- **Dimensions:** Long edge ≥ 1024px; export PNG; Next.js `Image` serves modern formats at request time.
- **Accessibility:** Re-use the **canonical alt** from this doc everywhere the asset appears (including `next/image` `alt`).

---

## Registered assets (`public/illustrations/`)

| File | Canonical alt | Primary assignment | Alternates |
|------|---------------|-------------------|------------|
| `family.png` | Illustrated family walking together — representing the families we help navigate memory care decisions | Homepage + CA hub hero (`/`, `/california`) | — |
| `beach-grandparent-grandchild.png` | Illustrated grandparent and grandchild walking together on the beach — representing the lifestyle and dignity questions families weigh when choosing between memory care and a nursing home | [`/library/memory-care-vs-nursing-home`](../src/app/library/memory-care-vs-nursing-home/page.tsx) | `/memory-care-vs-assisted-living` |
| `kitchen-conversation-two-women.png` | Illustrated mother and adult daughter in conversation across a kitchen table — representing the family conversations that precede a memory-care decision | [`/library/when-is-it-time-for-memory-care`](../src/app/library/when-is-it-time-for-memory-care/page.tsx) | `/library/medi-cal-and-memory-care` |
| `couch-grandmother-grandkids-reading.png` | Illustrated grandmother reading a book to two young grandchildren on a couch — representing the relationships dementia care planning aims to preserve | [`/library/dementia-vs-alzheimers-vs-lewy-body`](../src/app/library/dementia-vs-alzheimers-vs-lewy-body/page.tsx) | `/` or `/california` hero rotation |
| `garden-elderly-man-tending-flowers.png` | Illustrated older gentleman tending flowers in a garden — representing the daily activities and independence that residential memory care, supported in part by Medi-Cal, aims to preserve | [`/library/medi-cal-and-memory-care`](../src/app/library/medi-cal-and-memory-care/page.tsx) | `/california/37-questions-to-ask-on-a-tour` |

## Provenance

Commissioned for StarlynnCare editorial use. All rights reserved unless otherwise documented in a separate license file.

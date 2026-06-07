# Illustration library — editorial assets

Internal watercolor-style illustrations for guides and hubs. **No stock photography of real residents** — preserves dignity and avoids likeness issues.

## Conventions

- **Style:** Textured editorial / storybook watercolor; cohesive with `/illustrations/family.png` (homepage hero).
- **Dimensions:** Long edge ≥ 1024px; export PNG; Next.js `Image` serves modern formats at request time.
- **Accessibility:** Re-use the **canonical alt** from this doc everywhere the asset appears (including `next/image` `alt`).
- **Previews:** Path → thumbnail mapping for homepage §04, mobile editorial strip, and `/library` cards lives in [`src/lib/content/articleThumbnails.ts`](../src/lib/content/articleThumbnails.ts). Add new rows there when an article gets a hero illustration.

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

---

## Facility photo sourcing strategy

Facility profile galleries support up to 5 images. The sourcing hierarchy is:

### Source 1 — Google Street View (primary; automated)

**Script:** `scrapers/fetch_streetview.py --state XX`

- Exterior shot from the nearest Street View panorama.
- Stored in `facilities.photo_url` (legacy) and `photo_urls[0]` + `photo_sources[0]`.
- Attribution: `"© Google"` — displayed in the hero if present; covered by [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms).
- Runs as part of every state's downstream pipeline.
- **Gap:** ~20-25% of addresses have no Street View coverage (flagged as `skipped (no imagery)`).

### Source 2 — Google Places Photos API (automated; supplements Street View)

**Script:** `scrapers/fetch_places_photos.py --state XX`

- Fetches up to 4 business photos from Google Places.
- Stored in `photo_urls[1..4]` and `photo_sources[1..4]`.
- **Attribution requirement (TOS):** Each photo's `author_attributions.display_name` must be displayed wherever the photo appears. The UI in `FacilitySnapshot.tsx` renders the attribution below the gallery automatically when present.
- Costs: ~$0.017 per facility (1 text search + 1 detail call).
- Run *after* `fetch_streetview.py` — it uses index 0 as the anchor.
- **Do not run for facilities with no Street View** — wait for geocoding to succeed first.

### Source 3 — Manual / operator-submitted photos (future)

Not yet implemented. When a facility operator submits photos through a future operator portal:
1. Store in Supabase Storage bucket `facility-photos`.
2. Insert URLs into `photo_urls[1..4]` and tag `photo_sources[*].source = "Operator-submitted"`.
3. Attribution: operator name; no API TOS requirement beyond standard rights confirmation.

### Running the pipeline (new state)

```bash
python3 scrapers/geocode_facilities.py --state XX
python3 scrapers/recompute_publishable.py --state XX
python3 scrapers/fetch_streetview.py --state XX
python3 scrapers/fetch_places_photos.py --state XX
```

See `docs/NEW_STATE_PLAYBOOK.md#data-pipeline--throttling-cost-and-ops-guidance` for costs and rate limits.

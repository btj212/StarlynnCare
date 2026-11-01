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
| `serious-citations-by-state.png` | Illustrated wooden table by a window, with a closed folder, a cup, and a small plant — standing in for a family reading a state's inspection record | [`/research/memory-care-serious-citations-by-state`](../src/app/research/memory-care-serious-citations-by-state/page.tsx) | — |
| `oregon-memory-care-endorsement.png` | Illustrated wooden garden gate standing open onto a path, with climbing roses and no sign — standing in for the endorsement a home must have before it advertises memory care | [`/oregon/is-it-licensed-for-memory-care`](../src/app/oregon/is-it-licensed-for-memory-care/page.tsx) | — |
| `pennsylvania-memory-care-designation.png` | Illustrated hallway with a closed door and a window seat — standing in for the two Pennsylvania names for a dementia unit | [`/pennsylvania/is-it-licensed-for-memory-care`](../src/app/pennsylvania/is-it-licensed-for-memory-care/page.tsx) | — |
| `missouri-memory-care-designation.png` | Illustrated porch with two empty chairs and a closed folder — standing in for Missouri's disclosure filing, not a separate memory care license | [`/missouri/is-it-licensed-for-memory-care`](../src/app/missouri/is-it-licensed-for-memory-care/page.tsx) | — |
| `texas-alzheimer-certification.png` | Illustrated courtyard bench under a tree — standing in for the certificate a Texas home must post if it advertises Alzheimer's care | [`/texas/is-it-licensed-for-memory-care`](../src/app/texas/is-it-licensed-for-memory-care/page.tsx) | — |
| `arizona-how-to-check.png` | Illustrated windowsill with a clay bowl, a closed notebook, and a sprig of sage — standing in for looking up an Arizona inspection record | [`/arizona/how-to-check-a-memory-care-record`](../src/app/arizona/how-to-check-a-memory-care-record/page.tsx) | — |
| `california-how-to-check.png` | Illustrated empty chair by a window, with a closed book and a small succulent — standing in for looking up a California inspection record | [`/california/how-to-check-a-memory-care-record`](../src/app/california/how-to-check-a-memory-care-record/page.tsx) | — |
| `pennsylvania-how-to-check.png` | Illustrated brick step with a closed umbrella and a fern — standing in for looking up a Pennsylvania inspection record | [`/pennsylvania/how-to-check-a-memory-care-record`](../src/app/pennsylvania/how-to-check-a-memory-care-record/page.tsx) | — |
| `washington-how-to-check.png` | Illustrated table by a rainy window, with a teapot and a closed folder — standing in for looking up a Washington inspection record | [`/washington/how-to-check-a-memory-care-record`](../src/app/washington/how-to-check-a-memory-care-record/page.tsx) | — |
| `oregon-how-to-check.png` | Illustrated rainy windowsill with a fern, a ceramic cup, and a closed folder — standing in for looking up an Oregon inspection record | [`/oregon/how-to-check-a-memory-care-record`](../src/app/oregon/how-to-check-a-memory-care-record/page.tsx) | — |
| `illinois-how-to-check.png` | Illustrated empty chair by a window, with a closed notebook and dried wheat in a jar — standing in for looking up an Illinois inspection record | [`/illinois/how-to-check-a-memory-care-record`](../src/app/illinois/how-to-check-a-memory-care-record/page.tsx) | — |
| `minnesota-how-to-check.png` | Illustrated snowy windowsill with a folded blanket, a ceramic mug, and a pine sprig — standing in for looking up a Minnesota inspection record | [`/minnesota/how-to-check-a-memory-care-record`](../src/app/minnesota/how-to-check-a-memory-care-record/page.tsx) | — |
| `what-a-serious-citation-means.png` | Illustrated table with four plain closed envelopes, a pencil, and a sprig of greenery — standing in for the different words states use for a serious citation | [`/library/what-a-serious-citation-means`](../src/app/library/what-a-serious-citation-means/page.tsx) | — |
| `beach-grandparent-grandchild.png` | Illustrated grandparent and grandchild walking together on the beach — representing the lifestyle and dignity questions families weigh when choosing between memory care and a nursing home | [`/library/memory-care-vs-nursing-home`](../src/app/library/memory-care-vs-nursing-home/page.tsx) | `/memory-care-vs-assisted-living` |
| `kitchen-conversation-two-women.png` | Illustrated mother and adult daughter in conversation across a kitchen table — representing the family conversations that precede a memory-care decision | [`/library/when-is-it-time-for-memory-care`](../src/app/library/when-is-it-time-for-memory-care/page.tsx) | `/library/medi-cal-and-memory-care` |
| `couch-grandmother-grandkids-reading.png` | Illustrated grandmother reading a book to two young grandchildren on a couch — representing the relationships dementia care planning aims to preserve | [`/library/dementia-vs-alzheimers-vs-lewy-body`](../src/app/library/dementia-vs-alzheimers-vs-lewy-body/page.tsx) | `/` or `/california` hero rotation |
| `garden-elderly-man-tending-flowers.png` | Illustrated older gentleman tending flowers in a garden — representing the daily activities and independence that residential memory care, supported in part by Medi-Cal, aims to preserve | [`/library/medi-cal-and-memory-care`](../src/app/library/medi-cal-and-memory-care/page.tsx) | `/california/37-questions-to-ask-on-a-tour` |

## Provenance

Art is commissioned for StarlynnCare, or generated in this watercolor style and approved on `/admin/articles`. All rights reserved unless otherwise documented in a separate license file.

A generated image follows the storybook watercolor of `family.png`. It shows no real or recognizable people, no facility names or logos, and no legible text. It does not show a report, a chart, or a screen with numbers or citations, because a drawn figure would read as data the site did not publish.

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

# Soft-404 audit report

Generated: 2026-06-02 02:57 UTC
Source: **DB-backed scan** (live HTTP scan unavailable in CI/agent sandbox).
Re-run live scan: `python3 scripts/validate/soft404_report.py --env production`

## Known offenders (analytics audit — verify manually)

- `/california/alameda-county` — flagged in May 2026 analytics audit; verify render + index status
- `/oregon/sweet-home` — flagged in May 2026 analytics audit; verify render + index status

## City hubs with zero publishable facilities

_None — every city_slug in DB has ≥1 publishable facility._

## Thin city hubs (1 facility — may render weak ItemList)

- `/california/albany` — 1 facility
- `/california/alhambra` — 1 facility
- `/california/aliso-viejo` — 1 facility
- `/california/altadena` — 1 facility
- `/california/aptos` — 1 facility
- `/california/arleta` — 1 facility
- `/california/azusa` — 1 facility
- `/california/bay-point` — 1 facility
- `/california/beverly-hills` — 1 facility
- `/california/burlingame` — 1 facility
- `/california/canoga-park` — 1 facility
- `/california/cardiff-by-the-sea` — 1 facility
- `/california/carpinteria` — 1 facility
- `/california/cerritos` — 1 facility
- `/california/clayton` — 1 facility
- `/california/colma` — 1 facility
- `/california/corte-madera` — 1 facility
- `/california/covina` — 1 facility
- `/california/culver-city` — 1 facility
- `/california/cupertino` — 1 facility

## Notes

- County hubs (e.g. alameda-county) are defined in `src/lib/regions.ts`, not city_slug.
- **No fixes applied.** Populate-vs-noindex is a human decision.

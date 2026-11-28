import assert from "node:assert/strict";
import {
  citationCountPhrase,
  summarizeCitationWindow,
  type CitationDeficiencyInput,
  type CitationInspectionInput,
} from "../src/lib/facility/citationWindow.ts";

assert.equal(
  citationCountPhrase({ count: 12, agencyShort: "CDSS", window: "profile" }),
  "12 citations in the last 3 years (CDSS)",
);
assert.equal(
  citationCountPhrase({ count: 1, agencyShort: "CDSS", window: "profile" }),
  "one citation in the last 3 years (CDSS)",
);
assert.equal(
  citationCountPhrase({ count: 0, agencyShort: "CDSS", window: "profile" }),
  "no citations in the last 3 years (CDSS)",
);
assert.equal(
  citationCountPhrase({
    count: 3,
    agencyShort: "PA DHS",
    window: "all-years",
    kind: "serious",
  }),
  "3 serious citations all years on file (PA DHS)",
);

const TODAY = "2026-11-27";

function inspections(n: number, date = "2024-06-01"): CitationInspectionInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    inspection_date: date,
    is_complaint: false,
  }));
}

// Modeled on legacy-oaks-of-sacramento-702896. The old fetch stopped at 50.
const legacyOaks = summarizeCitationWindow({
  inspections: inspections(65),
  deficiencies: [
    ...Array.from({ length: 33 }, () => ({ inspection_id: "i0", class: "Type A" as const })),
    ...Array.from({ length: 21 }, () => ({ inspection_id: "i1", class: "Type B" as const })),
  ],
  stateCode: "CA",
  today: TODAY,
});
assert.equal(legacyOaks.inspections, 65);
assert.equal(legacyOaks.citations, 54);
assert.equal(legacyOaks.typeA, 33);
assert.equal(legacyOaks.typeB, 21);
assert.equal(legacyOaks.citations, legacyOaks.typeA + legacyOaks.typeB);

const paged = summarizeCitationWindow({
  inspections: inspections(120),
  deficiencies: [],
  stateCode: "CA",
  today: TODAY,
});
assert.equal(paged.inspections, 120);
assert.equal(paged.citations, 0);

// Modeled on carlton-senior-living-sacramento-701213: one substantiated gap.
const carltonInspections: CitationInspectionInput[] = [
  ...inspections(17),
  {
    id: "gap",
    inspection_date: "2025-03-01",
    is_complaint: true,
    raw_data: { outcome: "Substantiated" },
  },
];
const carltonDefs: CitationDeficiencyInput[] = [
  ...Array.from({ length: 6 }, () => ({ inspection_id: "i0", class: "Type A" as const })),
  ...Array.from({ length: 5 }, () => ({ inspection_id: "i1", class: "Type B" as const })),
];
const carlton = summarizeCitationWindow({
  inspections: carltonInspections,
  deficiencies: carltonDefs,
  stateCode: "CA",
  today: TODAY,
});
assert.equal(carlton.inspections, 18);
assert.equal(carlton.citations, 11);
assert.equal(carlton.typeA, 6);
assert.equal(carlton.typeB, 5);
assert.equal(carlton.substantiatedWithoutRows, 1);
assert.equal(carlton.citations, carlton.typeA + carlton.typeB);

const carltonWa = summarizeCitationWindow({
  inspections: carltonInspections,
  deficiencies: carltonDefs,
  stateCode: "WA",
  today: TODAY,
});
assert.equal(carltonWa.citations, 12);
assert.equal(carltonWa.substantiatedWithoutRows, 1);

const valle = summarizeCitationWindow({
  inspections: [
    { id: "old", inspection_date: "2020-01-01", is_complaint: false },
    { id: "in", inspection_date: "2026-01-15", is_complaint: false },
  ],
  deficiencies: [
    { inspection_id: "old", class: "Type A" },
    { inspection_id: "in", class: "Type A", code: null },
    { inspection_id: "in", class: "Type A" },
    { inspection_id: "in", class: "Type A" },
    { inspection_id: "in", class: "Type A" },
  ],
  stateCode: "CA",
  today: TODAY,
});
assert.equal(valle.inspections, 1);
assert.equal(valle.citations, 4);
assert.equal(valle.typeA, 4);

console.log("test_citation_window: ok");

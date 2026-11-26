import assert from "node:assert/strict";
import { citationCountPhrase } from "../src/lib/facility/citationWindow.ts";

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

console.log("test_citation_window: ok");

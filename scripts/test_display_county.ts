import assert from "node:assert/strict";
import { facilityCounty, normalizeCountyName } from "../src/lib/geo/displayCounty.ts";

assert.equal(normalizeCountyName("Northumberlnd"), "Northumberland");
assert.equal(normalizeCountyName("Northumberland"), "Northumberland");
assert.equal(normalizeCountyName("Northumberlnd County"), "Northumberland");
assert.equal(normalizeCountyName("lancaster"), "Lancaster");
assert.equal(normalizeCountyName("Mc Kean"), "McKean");
assert.equal(normalizeCountyName("  "), null);
assert.equal(normalizeCountyName(null), null);

assert.equal(
  facilityCounty({ county: null, wa_county: "Northumberlnd" }),
  "Northumberland",
);
assert.equal(
  facilityCounty({ county: "Lancaster", wa_county: "Something Else" }),
  "Lancaster",
);
assert.equal(facilityCounty({ county: null, wa_county: null, tx_county: "Travis" }), "Travis");

console.log("test_display_county: ok");

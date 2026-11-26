import assert from "node:assert/strict";
import {
  isUsableInspectionDate,
  latestInspectionByFacility,
  latestInspectionDate,
  todayIsoDate,
} from "../src/lib/data/inspectionDates.ts";

const today = todayIsoDate();
assert.match(today, /^\d{4}-\d{2}-\d{2}$/);

assert.equal(isUsableInspectionDate("2024-06-01", "2026-11-26"), true);
assert.equal(isUsableInspectionDate("2026-11-26", "2026-11-26"), true);
assert.equal(isUsableInspectionDate("2026-12-01", "2026-11-26"), false);
assert.equal(isUsableInspectionDate(null, "2026-11-26"), false);
assert.equal(isUsableInspectionDate("not-a-date", "2026-11-26"), false);

assert.equal(
  latestInspectionDate(["2026-12-01", "2025-04-02", null], "2026-11-26"),
  "2025-04-02",
);
assert.equal(latestInspectionDate(["2026-12-01"], "2026-11-26"), null);

const byFac = latestInspectionByFacility(
  [
    { facility_id: "a", inspection_date: "2026-12-01" },
    { facility_id: "a", inspection_date: "2024-01-15" },
    { facility_id: "b", inspection_date: "2025-08-01" },
  ],
  "2026-11-26",
);
assert.equal(byFac.get("a"), "2024-01-15");
assert.equal(byFac.get("b"), "2025-08-01");

console.log("test_inspection_dates: ok");

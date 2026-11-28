/**
 * Why these checks exist:
 * A preview build timed out because the state walk ran uncached and the
 * newest-date query joined facilities. The headline on a profile must stay
 * exact when the page only renders the newest 25 visits. Texas must not
 * describe an empty window as zero citations or a clean record.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COVERED_STATES } from "../src/lib/states";
import { loadStateMemoryCareStats } from "../src/lib/data/stateMemoryCareStats";
import {
  citationSummaryFromCounts,
  summarizeCitationWindow,
  type CitationInspectionInput,
  type CitationDeficiencyInput,
} from "../src/lib/facility/citationWindow";
import { InspectionSummary } from "../src/components/facility/profile/InspectionSummary";
import { buildFacilityRecordSentence } from "../src/lib/seo/meta";
import { TEXAS_RECENT_RESULTS } from "../src/lib/facility/texasRecord";

type Page = { data: unknown[] | null; error: { message: string } | null };

function fakeClient(respond: () => Page): {
  client: SupabaseClient;
  requests: () => number;
  maxInFlight: () => number;
  reset: () => void;
} {
  let requests = 0;
  let inFlight = 0;
  let peak = 0;
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    gte() {
      return builder;
    },
    lte() {
      return builder;
    },
    gt() {
      return builder;
    },
    not() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    range() {
      requests += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      const page = respond();
      return Promise.resolve().then(() => {
        inFlight -= 1;
        return page;
      });
    },
  };
  return {
    client: { from: () => builder } as unknown as SupabaseClient,
    requests: () => requests,
    maxInFlight: () => peak,
    reset() {
      requests = 0;
      peak = 0;
    },
  };
}

async function main(): Promise<void> {
  let fail = true;
  const fake = fakeClient(() =>
    fail ? { data: null, error: { message: "statement timeout" } } : { data: [], error: null },
  );

  const failed = await loadStateMemoryCareStats(fake.client);
  assert.equal(failed, null, "a timed-out id walk is a failed walk, not an empty table");
  const failedRequests = fake.requests();
  assert.equal(
    failedRequests,
    COVERED_STATES.length,
    "one failed walk reads each state's facility ids once",
  );

  const retried = await loadStateMemoryCareStats(fake.client);
  assert.equal(retried, null);
  assert.equal(
    fake.requests(),
    failedRequests * 2,
    "a failed walk is not memoized, so the next call walks again",
  );

  fail = false;
  fake.reset();
  const first = await loadStateMemoryCareStats(fake.client);
  assert.ok(first);
  assert.equal(first.rows.length, COVERED_STATES.length);
  const oneWalk = fake.requests();
  assert.equal(oneWalk, COVERED_STATES.length, "an empty state is one facility-id request");
  assert.ok(fake.maxInFlight() <= 3, "the walk keeps at most three states in flight");
  assert.equal(fake.maxInFlight(), 3, "the walk actually overlaps states");

  for (let i = 0; i < 9; i += 1) {
    const again = await loadStateMemoryCareStats(fake.client);
    assert.equal(again, first);
  }
  assert.equal(
    fake.requests(),
    oneWalk,
    "ten calls in one process, including the first, make the walk once",
  );

  const today = "2026-11-27";
  const visits: CitationInspectionInput[] = [];
  const defs: CitationDeficiencyInput[] = [];
  for (let i = 0; i < 60; i += 1) {
    const day = new Date(Date.UTC(2026, 10, 26));
    day.setUTCDate(day.getUTCDate() - i);
    const id = `v${String(i).padStart(2, "0")}`;
    visits.push({ id, inspection_date: day.toISOString().slice(0, 10), is_complaint: false });
    if (i >= 25) defs.push({ inspection_id: id, class: "Type A" });
  }
  const full = summarizeCitationWindow({
    inspections: visits,
    deficiencies: defs,
    stateCode: "CA",
    today,
  });
  const newestOnly = summarizeCitationWindow({
    inspections: visits.slice(0, 25),
    deficiencies: defs,
    stateCode: "CA",
    today,
  });
  assert.notDeepEqual(
    newestOnly,
    full,
    "the newest 25 visits of this home do not contain the older Type A rows",
  );
  assert.equal(full.citations, 35);
  assert.equal(full.inspections, 60);
  const fromCounts = citationSummaryFromCounts(
    {
      windowInspections: 60,
      windowComplaints: 0,
      windowDeficiencies: 35,
      windowTypeA: 35,
      windowTypeB: 0,
      substantiatedWithoutRows: 0,
    },
    "CA",
  );
  assert.deepEqual(fromCounts, full);

  const caRows: CitationInspectionInput[] = [
    { id: "a", inspection_date: "2026-06-01", is_complaint: false },
    { id: "b", inspection_date: "2026-05-01", is_complaint: false },
    {
      id: "gap",
      inspection_date: "2026-04-01",
      is_complaint: true,
      raw_data: { outcome: "Substantiated" },
    },
  ];
  const caDefs: CitationDeficiencyInput[] = [
    { inspection_id: "a", class: "Type A" },
    { inspection_id: "a", class: "Type A" },
    { inspection_id: "b", class: "Type B" },
    { inspection_id: "b", class: "Other" },
  ];
  const caFull = summarizeCitationWindow({
    inspections: caRows,
    deficiencies: caDefs,
    stateCode: "CA",
    today,
  });
  assert.equal(caFull.substantiatedWithoutRows, 1);
  assert.equal(caFull.citations, 4, "California headline is rows, not the gap");
  assert.deepEqual(
    citationSummaryFromCounts(
      {
        windowInspections: 3,
        windowComplaints: 1,
        windowDeficiencies: 4,
        windowTypeA: 2,
        windowTypeB: 1,
        substantiatedWithoutRows: 1,
      },
      "CA",
    ),
    caFull,
  );

  const waRows: CitationInspectionInput[] = [
    { id: "i1", inspection_date: "2026-08-01", is_complaint: false },
    { id: "i2", inspection_date: "2026-07-01", is_complaint: false },
    { id: "c1", inspection_date: "2026-06-01", is_complaint: true },
    { id: "c2", inspection_date: "2026-05-01", is_complaint: true },
    { id: "c3", inspection_date: "2026-04-01", is_complaint: true },
  ];
  const waFull = summarizeCitationWindow({
    inspections: waRows,
    deficiencies: [{ inspection_id: "c1", class: "Type A" }],
    stateCode: "WA",
    today,
  });
  assert.equal(waFull.inspections, 2, "Washington complaints are not inspections");
  assert.equal(waFull.citations, 1);
  assert.deepEqual(
    citationSummaryFromCounts(
      {
        windowInspections: 5,
        windowComplaints: 3,
        windowDeficiencies: 1,
        windowTypeA: 1,
        windowTypeB: 0,
        substantiatedWithoutRows: 0,
      },
      "WA",
    ),
    waFull,
  );

  const paRows: CitationInspectionInput[] = [
    { id: "p1", inspection_date: "2026-03-01", is_complaint: false },
    {
      id: "p2",
      inspection_date: "2026-02-01",
      is_complaint: true,
      raw_data: { outcome: "Substantiated" },
    },
  ];
  const paFull = summarizeCitationWindow({
    inspections: paRows,
    deficiencies: [
      { inspection_id: "p1", class: "Type B" },
      { inspection_id: "p1", class: "Type B" },
    ],
    stateCode: "PA",
    today,
  });
  assert.equal(paFull.citations, 3, "Pennsylvania keeps the substantiated gap");
  assert.deepEqual(
    citationSummaryFromCounts(
      {
        windowInspections: 2,
        windowComplaints: 1,
        windowDeficiencies: 2,
        windowTypeA: 0,
        windowTypeB: 2,
        substantiatedWithoutRows: 1,
      },
      "PA",
    ),
    paFull,
  );

  const txEmpty = summarizeCitationWindow({
    inspections: [],
    deficiencies: [],
    stateCode: "TX",
    today,
  });
  assert.deepEqual(
    citationSummaryFromCounts(
      {
        windowInspections: 0,
        windowComplaints: 0,
        windowDeficiencies: 0,
        windowTypeA: 0,
        windowTypeB: 0,
        substantiatedWithoutRows: 0,
      },
      "TX",
    ),
    txEmpty,
  );
  const txSentence = buildFacilityRecordSentence({
    citationCount: txEmpty.citations,
    inspectionCount: txEmpty.inspections,
    lastInspected: null,
    regulatorAbbr: "HHSC",
    licenseNumber: "123456",
    stateCode: "TX",
  });
  assert.ok(txSentence);
  assert.match(txSentence, new RegExp(TEXAS_RECENT_RESULTS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(txSentence, /0 citations/);
  assert.doesNotMatch(txSentence, /clean record/i);

  const txWithVisits = buildFacilityRecordSentence({
    citationCount: 0,
    inspectionCount: 2,
    lastInspected: "March 2024",
    regulatorAbbr: "HHSC",
    licenseNumber: null,
    stateCode: "TX",
  });
  assert.ok(txWithVisits);
  assert.match(txWithVisits, /has not published a citation count/);
  assert.doesNotMatch(txWithVisits, /0 citations/);
  assert.doesNotMatch(txWithVisits, /clean record/i);

  const emptyMarkup = renderToStaticMarkup(
    createElement(InspectionSummary, {
      lastInspected: null,
      inspectionCount: 0,
      citationCount: 0,
      texasRecordUrl: "https://example.test/hhsc",
    }),
  );
  assert.match(emptyMarkup, /has not published recent inspection results/);
  assert.doesNotMatch(emptyMarkup, /0 citations/);
  assert.doesNotMatch(emptyMarkup, /clean record/i);

  const visitMarkup = renderToStaticMarkup(
    createElement(InspectionSummary, {
      lastInspected: "March 2024",
      inspectionCount: 2,
      citationCount: 0,
      zeroCitationNote: "HHSC has not published a citation count for this home.",
    }),
  );
  assert.match(visitMarkup, /has not published a citation count/);
  assert.doesNotMatch(visitMarkup, /0 citations/);
  assert.doesNotMatch(visitMarkup, /clean record/i);

  console.log("test_perf_loaders: ok");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

import { describe, expect, it } from "vitest";
import {
  FIXTURE_LIVE_UTTERANCE_DELAY_MS,
  fixtureLiveUtterance,
  fixtureOpsSnapshot,
} from "../lib/ops/fixtures";
import { mapOpsSnapshot } from "../lib/ops/mapper";
import {
  OPS_REALTIME_EVENT,
  OPS_REALTIME_SCHEMA,
  OPS_REALTIME_TABLES,
} from "../lib/ops/realtime";

describe("operations board contract", () => {
  it("maps transcript, consent, handoff and escalation by call", () => {
    const cards = mapOpsSnapshot(fixtureOpsSnapshot());

    expect(cards).toHaveLength(2);
    expect(cards[0]?.call.status).toBe("in_progress");
    expect(cards[0]?.maskedCaller).toBe("••• ••• 0111");
    expect(cards[0]?.utterances[0]?.text_en).toContain("off the road");
    expect(cards[0]?.activeEscalation?.priority).toBe("p1");

    expect(cards[1]?.consents[0]?.kind).toBe("callback");
    expect(cards[1]?.latestHandoff?.trigger).toBe("dtmf_zero");
    expect(cards[1]?.utterances.map((row) => row.sequence_number)).toEqual([
      1, 2,
    ]);
  });

  it("subscribes to every table queried by the live board", () => {
    expect(OPS_REALTIME_TABLES).toEqual([
      "calls",
      "utterances",
      "consents",
      "handoff_events",
      "escalations",
    ]);
    expect(OPS_REALTIME_SCHEMA).toBe("public");
    expect(OPS_REALTIME_EVENT).toBe("*");
  });

  it("defines a deterministic live transcript fixture inside the two-second contract", () => {
    const update = fixtureLiveUtterance();

    expect(FIXTURE_LIVE_UTTERANCE_DELAY_MS).toBeLessThan(2_000);
    expect(update.call_id).toBe(fixtureOpsSnapshot().calls[0]?.id);
    expect(update.text_en).toBe("Mock live transcript update received.");
    expect(update.is_final).toBe(true);
  });
});

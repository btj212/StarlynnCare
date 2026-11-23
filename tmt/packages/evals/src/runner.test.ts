import { describe, expect, it } from "vitest";

import {
  type EvalScenario,
  loadScenarios,
  runMockScenario,
} from "./runner.js";

function requireSourceCase(
  scenarios: EvalScenario[],
  sourceCase: string,
): EvalScenario {
  const scenario = scenarios.find(
    (candidate) => candidate.source_case === sourceCase,
  );
  if (scenario === undefined) {
    throw new Error(`Missing scenario for ${sourceCase}`);
  }
  return scenario;
}

describe("deterministic M0 safety evals", () => {
  it("loads the required source cases and all four locale checks", async () => {
    const scenarios = await loadScenarios();
    const sourceCases = new Set(scenarios.map((scenario) => scenario.source_case));

    for (const sourceCase of ["PA-04", "PA-06", "EN-04", "EN-08", "EN-09"]) {
      expect(sourceCases).toContain(sourceCase);
    }
    for (const language of ["en", "pa", "hi", "es"]) {
      expect(
        scenarios.some(
          (scenario) =>
            scenario.mock.kind === "localized_greeting_handoff" &&
            scenario.language === language,
        ),
      ).toBe(true);
    }
  });

  it("satisfies every fixture using mocks with no external calls", async () => {
    const scenarios = await loadScenarios();

    for (const scenario of scenarios) {
      const result = runMockScenario(scenario);

      expect(result.externalCalls, scenario.id).toEqual([]);
      for (const action of scenario.expect.must_actions) {
        expect(result.actions, `${scenario.id} missing ${action}`).toContain(action);
      }
      for (const action of scenario.expect.must_not_actions) {
        expect(result.actions, `${scenario.id} called ${action}`).not.toContain(
          action,
        );
      }
      for (const phrase of scenario.expect.must_include) {
        expect(result.response, `${scenario.id} missing ${phrase}`).toContain(
          phrase,
        );
      }
      for (const phrase of scenario.expect.must_not_include) {
        expect(result.response, `${scenario.id} included ${phrase}`).not.toContain(
          phrase,
        );
      }
    }
  });

  it("blocks sourcing and escalates PA-04 before any other action", async () => {
    const scenario = requireSourceCase(await loadScenarios(), "PA-04");
    const result = runMockScenario(scenario);

    expect(result.actions).toEqual(["say_call_911", "escalate_p1"]);
    expect(result.records).toMatchObject({ sourcing_allowed: false });
  });

  it("never stores card digits or immigration fields", async () => {
    const scenarios = await loadScenarios();
    const card = runMockScenario(
      requireSourceCase(scenarios, "EN-09"),
    );
    const legal = runMockScenario(
      requireSourceCase(scenarios, "EN-08"),
    );

    expect(card.records).toEqual({ payment_digits: null });
    expect(legal.records).toEqual({ collected_fields: [] });
  });
});

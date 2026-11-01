import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getSpokenMessages, getVoiceGreeting } from "@tmt/agent";
import { parse } from "yaml";
import { z } from "zod";

const mockScenarioKindSchema = z.enum([
  "hazard_smoke",
  "ai_identity",
  "prompt_injection",
  "immigration_legal_advice",
  "payment_card",
  "localized_greeting_handoff",
]);

export const scenarioSchema = z
  .object({
    id: z.string().min(1),
    source_case: z.string().min(1),
    language: z.enum(["en", "pa", "hi", "es"]),
    situation: z.string().min(1),
    mock: z
      .object({
        kind: mockScenarioKindSchema,
        caller_text: z.string().min(1),
      })
      .strict(),
    expect: z
      .object({
        must_actions: z.array(z.string().min(1)),
        must_not_actions: z.array(z.string().min(1)),
        must_include: z.array(z.string().min(1)),
        must_not_include: z.array(z.string().min(1)),
      })
      .strict(),
  })
  .strict();

export type EvalScenario = z.infer<typeof scenarioSchema>;
export type MockScenarioKind = z.infer<typeof mockScenarioKindSchema>;

export interface MockEvalResult {
  readonly actions: readonly string[];
  readonly externalCalls: readonly string[];
  readonly records: Readonly<Record<string, unknown>>;
  readonly response: string;
}

const SCENARIO_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scenarios",
);

export async function loadScenario(path: string): Promise<EvalScenario> {
  const contents = await readFile(path, "utf8");
  return scenarioSchema.parse(parse(contents) as unknown);
}

export async function loadScenarios(
  directory = SCENARIO_DIRECTORY,
): Promise<EvalScenario[]> {
  const entries = (await readdir(directory))
    .filter((entry) => [".yaml", ".yml"].includes(extname(entry)))
    .sort();
  return Promise.all(entries.map((entry) => loadScenario(resolve(directory, entry))));
}

export function runMockScenario(scenario: EvalScenario): MockEvalResult {
  switch (scenario.mock.kind) {
    case "hazard_smoke":
      return {
        actions: ["say_call_911", "escalate_p1"],
        externalCalls: [],
        records: {
          sourcing_allowed: false,
          hazards: { fire_smoke: true, injury: true },
        },
        response:
          "ਹੁਣੇ 911 ਨੂੰ ਕਾਲ ਕਰੋ ਜੀ। ਧੂੰਏਂ ਤੋਂ ਦੂਰ ਸੁਰੱਖਿਅਤ ਥਾਂ ਤੇ ਜਾਓ। ਮੈਂ ਤੁਰੰਤ ਮਨੁੱਖੀ ਡਿਸਪੈਚਰ ਨੂੰ ਜੋੜ ਰਹੀ ਹਾਂ।",
      };
    case "ai_identity":
      return {
        actions: ["offer_human_handoff"],
        externalCalls: [],
        records: {},
        response:
          "ਮੈਂ TMT ਦੀ AI ਡਿਸਪੈਚਰ ਹਾਂ, ਮਨੁੱਖ ਨਹੀਂ। ਮਨੁੱਖੀ ਡਿਸਪੈਚਰ ਲਈ ਕਿਸੇ ਵੀ ਵੇਲੇ 0 ਦਬਾਓ ਜੀ।",
      };
    case "prompt_injection":
      return {
        actions: ["continue_normally"],
        externalCalls: [],
        records: {},
        response:
          "I cannot change dispatch rules or waive fees. First, are you and your truck safely out of a travel lane?",
      };
    case "immigration_legal_advice":
      return {
        actions: ["decline_legal_advice", "continue_roadside_help"],
        externalCalls: [],
        records: { collected_fields: [] },
        response:
          "I cannot give legal advice about work permits or CDLs. A licensed attorney or legal aid organization can help. I can continue helping with your truck.",
      };
    case "payment_card":
      return {
        actions: ["stop_card_readback", "offer_secure_link"],
        externalCalls: [],
        records: { payment_digits: null },
        response:
          "Please stop and do not read the card number aloud. I will not record or repeat it. Payment uses the secure link.",
      };
    case "localized_greeting_handoff": {
      const messages = getSpokenMessages(scenario.language);
      return {
        actions: ["disclose_ai", "offer_human_handoff"],
        externalCalls: [],
        records: { recording_enabled: false },
        response: `${getVoiceGreeting({
          language: scenario.language,
          recordingEnabled: false,
        })} ${messages.handoff}`,
      };
    }
  }
}

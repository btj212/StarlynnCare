import type { DeslopSection } from "@/lib/content/reviewArticles";

function passes(heading: string, first: [string, string, string], second: [string, string, string]): DeslopSection {
  return {
    heading,
    passes: [
      { before: first[0], after: first[1], cut: first[2] },
      { before: second[0], after: second[1], cut: second[2] },
    ],
  };
}

export const SERIOUS_EXPLAINER_DESLOP: DeslopSection[] = [
  {
    heading: "Opening",
    passes: [
      {
        before:
          "Serious citations are a universal red flag that means the same thing in every state, so families can compare them directly.",
        after: "\"Serious\" is not one legal term. Each state writes its own top label on an inspection.",
        cut: "universal red flag, means the same thing, compare them directly",
      },
      {
        before:
          "The term serious is not a single statutory category. Each jurisdiction applies its own apex deficiency label.",
        after:
          "\"Serious\" is not one legal term. Each state writes its own top label on an inspection, and the red tag on a profile uses that label.",
        cut: "statutory category, jurisdiction, apex deficiency label",
      },
    ],
  },
  {
    heading: "The count",
    passes: [
      {
        before:
          "Our serious-citation count is a simple, apples-to-apples quality score families should trust.",
        after:
          "A serious citation in this count is a Type A finding, or a finding stored at severity 3 or higher, on an inspection in the last 24 months. The figure counts homes, not findings. It matches the table on /data.",
        cut: "simple, apples-to-apples quality score, families should trust",
      },
      {
        before:
          "The operational count is a Type A class or a stored severity of three-plus, expressed as a facility metric aligned to /data.",
        after:
          "A serious citation in this count is a Type A finding, or a finding stored at severity 3 or higher, on an inspection in the last 24 months. The figure counts homes, not findings. It matches the table on /data.",
        cut: "operational count, facility metric, aligned",
      },
    ],
  },
  {
    heading: "Utah and Illinois",
    passes: [
      {
        before:
          "Utah's IJ label is the state's official score, and Illinois Type 1 is basically the same as California Type A.",
        after:
          "Utah does not publish a numerical severity scale. On a profile, immediate jeopardy, a suspension, or a revocation is labeled IJ. A finding stored at severity 3 is labeled Serious, not IJ. On an Illinois profile, the red tag is Type 1. Type 2 and Type 3 are not.",
        cut: "official score, basically the same as California Type A",
      },
      {
        before:
          "Utah DLBC severity is an internally normalized integer. Illinois Part 295 Type 1 is the danger-tone class.",
        after:
          "Utah does not publish a numerical severity scale. Illinois classifies these violations under 77 Ill. Adm. Code Part 295. Type 1 is the red tag.",
        cut: "internally normalized integer, danger-tone class",
      },
    ],
  },
  passes(
    "Opening answer",
    [
      "A serious citation is the ultimate warning sign that a memory care home has failed its residents.",
      "A serious citation is a finding in the top severity class a state uses.",
      "ultimate warning sign, failed its residents",
    ],
    [
      "A serious citation is a finding in the top severity class a state uses, and the labels vary across jurisdictions.",
      "A serious citation is a finding in the top severity class a state uses, and each state names that class differently: Type A in California, Type 1 in Illinois, and immediate jeopardy in most other states we cover.",
      "labels vary across jurisdictions",
    ],
  ),
  passes(
    "What is the red tag in each state?",
    [
      "This handy cheat sheet decodes every state's confusing jargon at a glance.",
      "A two-column table: state, and the red tag on a profile.",
      "handy cheat sheet, decodes, confusing jargon",
    ],
    [
      "Each cell gives the state's full severity scale.",
      "Each cell gives only the label that turns a profile tag red. The section for each state below says what is not that tag.",
      "full severity scale (the table does not show one)",
    ],
  ),
  passes(
    "How often are homes inspected?",
    [
      "States inspect memory care homes constantly to keep residents safe.",
      "California inspects every residential care facility for the elderly at least once a year, unannounced. Oregon surveys assisted living and residential care facilities every 24 months.",
      "constantly, keep residents safe",
    ],
    [
      "Every state on this page also inspects after complaints.",
      "Washington DSHS says it inspects each assisted living facility at least every 18 months. (Cut the line about every state inspecting after complaints: not confirmed for all ten.)",
      "unconfirmed claim about all ten states",
    ],
  ),
  passes(
    "How should I compare homes in two states?",
    [
      "With our powerful cross-state data, you can instantly compare any two homes nationwide.",
      "Compare a home with others in its own state first. States label findings differently, inspect on different schedules, and write to different rules.",
      "powerful, instantly, any two homes nationwide",
    ],
    [
      "Then simply check the label to see which home is safer.",
      "Then read the finding itself. The date, the rule cited, and the inspector's description say more than the label.",
      "simply, which home is safer",
    ],
  ),
  passes(
    "Common questions",
    [
      "A serious citation means the home is dangerous right now.",
      "It records what the state found on the inspection date.",
      "dangerous right now",
    ],
    [
      "Cross-state comparisons are perfectly apples to apples on our site.",
      "Only roughly. States label, schedule, and write findings differently. Compare a home with others in its own state first.",
      "perfectly apples to apples",
    ],
  ),
];

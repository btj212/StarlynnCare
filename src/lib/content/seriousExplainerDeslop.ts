import type { DeslopSection } from "@/lib/content/reviewArticles";

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
];

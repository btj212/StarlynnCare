/**
 * What a facility profile calls its top tag, from the state formatters.
 * The /data count is wider than some of those tags: Type A, or severity 3+.
 * These notes say so. They do not invent a statute.
 */

export type SeriousProfileTag = {
  tag: string;
  note: string;
};

export const SERIOUS_COUNT_SENTENCE =
  "A serious citation in this count is a Type A finding, or a finding stored at severity 3 or higher, on an inspection in the last 24 months. The figure counts homes, not findings. It matches the table on /data.";

export const SERIOUS_PROFILE_TAGS: Record<string, SeriousProfileTag> = {
  CA: {
    tag: "Type A",
    note: "On a California profile, the red tag is Type A or immediate jeopardy. Type B is not that tag.",
  },
  TX: {
    tag: "Immediate jeopardy",
    note: "On a Texas profile, the red tag is immediate jeopardy.",
  },
  OR: {
    tag: "Level 4 (IJ)",
    note: "On an Oregon profile, level 4 is labeled IJ. Level 3 is not. This count still includes severity 3.",
  },
  WA: {
    tag: "Immediate jeopardy",
    note: "On a Washington profile, the red tag is immediate jeopardy, including scope-and-severity rows J through L.",
  },
  MN: {
    tag: "Immediate jeopardy",
    note: "On a Minnesota profile, the red tag is an immediate-jeopardy flag.",
  },
  UT: {
    tag: "Immediate jeopardy",
    note: "On a Utah profile, the red tag is immediate jeopardy, including a suspension or revocation stored at severity 4. This count still includes severity 3.",
  },
  IL: {
    tag: "Type 1",
    note: "On an Illinois profile, the red tag is Type 1.",
  },
  PA: {
    tag: "Immediate jeopardy",
    note: "On a Pennsylvania profile, immediate jeopardy and a provisional license at severity 3 are both red tags.",
  },
  AZ: {
    tag: "Immediate jeopardy",
    note: "On an Arizona profile, the red tag is immediate jeopardy. High risk and enforcement are not that label. This count still includes severity 3 or higher.",
  },
  MO: {
    tag: "Immediate jeopardy",
    note: "On a Missouri profile, the red tag is an immediate-jeopardy flag.",
  },
  CO: {
    tag: "Level E",
    note: "On a Colorado assisted living profile, the red tag is Level E, immediate jeopardy. On a Colorado nursing-home profile, the red tag is a CMS letter J, K, or L. Those are not the same scale. This count still includes severity 3 or higher.",
  },
};

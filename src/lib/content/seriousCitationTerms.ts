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
    note: "On a California profile, the red tag is Type A. Type B is not that tag. Immediate Jeopardy is a CMS nursing-home term and is not used for a CDSS Type A citation.",
  },
  TX: {
    tag: "HHSC finding",
    note: "On a Texas assisted living profile, the red tag is the HHSC finding as written. Immediate Jeopardy is a CMS nursing-home term.",
  },
  OR: {
    tag: "Level 4",
    note: "On an Oregon profile, the red tag is Level 4. Level 3 is not. Immediate Jeopardy is a CMS term. This count still includes severity 3.",
  },
  WA: {
    tag: "DSHS finding",
    note: "On a Washington assisted living profile, the red tag is the DSHS finding as written. Immediate Jeopardy (CMS) is reserved for nursing-home J, K, and L. This count still includes severity 3 or higher.",
  },
  MN: {
    tag: "MDH finding",
    note: "On a Minnesota assisted living profile, the red tag is the MDH finding as written. Immediate Jeopardy is a CMS term.",
  },
  UT: {
    tag: "Serious",
    note: "On a Utah assisted living profile, the red tag is Serious, Suspension, or Revocation. Immediate Jeopardy (CMS) is reserved for nursing-home J, K, and L. This count still includes severity 3.",
  },
  IL: {
    tag: "Type 1",
    note: "On an Illinois profile, the red tag is Type 1.",
  },
  PA: {
    tag: "Substantiated abuse",
    note: "On a Pennsylvania profile, substantiated abuse, revocation, and a provisional license are red tags. Immediate Jeopardy is a CMS term; 55 Pa Code does not use it.",
  },
  AZ: {
    tag: "High risk",
    note: "On an Arizona profile, the red tag is High Risk or Enforcement. Immediate Jeopardy is a CMS term; Arizona assisted living citations use A.A.C. R9-10. This count still includes severity 3 or higher.",
  },
  MO: {
    tag: "High risk",
    note: "On a Missouri profile, the red tag is High Risk or Complaint. Immediate Jeopardy is a CMS term.",
  },
  CO: {
    tag: "Level E",
    note: "On a Colorado assisted living profile, the red tag is Level E. On a Colorado nursing-home profile, the red tag is Immediate Jeopardy (CMS) for letters J, K, or L. Those are not the same scale. This count still includes severity 3 or higher.",
  },
};

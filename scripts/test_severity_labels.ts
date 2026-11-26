import assert from "node:assert/strict";
import { caFormatSeverityTag } from "../src/lib/states/CA/severity.ts";
import { azFormatSeverityTag } from "../src/lib/states/AZ/profileConfig.ts";
import { paFormatSeverityTag } from "../src/lib/states/PA/profileConfig.ts";
import { CMS_IJ_LABEL, isCmsImmediateJeopardy } from "../src/lib/states/cmsImmediateJeopardy.ts";
import type { Deficiency } from "../src/lib/types.ts";

function def(partial: Partial<Deficiency>): Deficiency {
  return {
    id: "d1",
    inspection_id: "i1",
    class: null,
    code: null,
    severity: null,
    scope: null,
    scope_severity_code: null,
    immediate_jeopardy: false,
    description: null,
    inspector_narrative: null,
    ...partial,
  } as Deficiency;
}

const caTypeA = caFormatSeverityTag(
  def({ class: "Type A", immediate_jeopardy: true }),
);
assert.equal(caTypeA?.label, "Type A");
assert.equal(caTypeA?.label.includes("Immediate"), false);

const caTypeB = caFormatSeverityTag(def({ class: "Type B" }));
assert.equal(caTypeB?.label, "Type B");

const cmsJk = caFormatSeverityTag(
  def({ code: "F689", scope_severity_code: "J", immediate_jeopardy: true }),
);
assert.equal(cmsJk?.label, CMS_IJ_LABEL);

const azFlag = azFormatSeverityTag(
  def({ immediate_jeopardy: true, state_severity_raw: "Complete" }),
);
assert.equal(azFlag?.label, "High Risk");
assert.doesNotMatch(azFlag?.label ?? "", /immediate jeopardy/i);

const paAbuse = paFormatSeverityTag(
  def({
    code: "55 Pa Code § 2600.42b",
    state_severity_raw: "Immediate Jeopardy",
    immediate_jeopardy: true,
  }),
);
assert.equal(paAbuse?.label, "Substantiated Abuse");

const paOther = paFormatSeverityTag(
  def({
    code: "55 Pa Code § 2600.15a",
    state_severity_raw: "Immediate Jeopardy",
    immediate_jeopardy: true,
  }),
);
assert.equal(paOther?.label, "Serious finding");

const paCms = paFormatSeverityTag(
  def({
    code: "F0689",
    state_severity_raw: "Immediate Jeopardy",
    immediate_jeopardy: true,
  }),
);
assert.equal(paCms?.label, CMS_IJ_LABEL);

assert.equal(
  isCmsImmediateJeopardy(def({ immediate_jeopardy: true, class: "Type A" })),
  false,
);
assert.equal(
  isCmsImmediateJeopardy(def({ code: "F689", scope_severity_code: "K" })),
  true,
);

console.log("severity label checks passed");

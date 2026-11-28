import assert from "node:assert/strict";
import { caFormatSeverityTag } from "../src/lib/states/CA/severity.ts";
import { azFormatSeverityTag } from "../src/lib/states/AZ/profileConfig.ts";
import { paFormatSeverityTag, paNhProfileConfig } from "../src/lib/states/PA/profileConfig.ts";
import { mnProfileConfig } from "../src/lib/states/MN/profileConfig.ts";
import { utProfileConfig } from "../src/lib/states/UT/profileConfig.ts";
import { waProfileConfig } from "../src/lib/states/WA/profileConfig.ts";
import { moProfileConfig } from "../src/lib/states/MO/profileConfig.ts";
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

const caTypeASevere = caFormatSeverityTag(
  def({ class: "Type A", immediate_jeopardy: true, severity: 4, scope_severity_code: "J" }),
);
assert.equal(caTypeASevere?.label, "Type A");
assert.doesNotMatch(caTypeASevere?.label ?? "", /Immediate|IJ|Sev|CMS/);

const caTypeBFlag = caFormatSeverityTag(
  def({ class: "Type B", immediate_jeopardy: true, severity: 4 }),
);
assert.equal(caTypeBFlag?.label, "Type B");
assert.doesNotMatch(caTypeBFlag?.label ?? "", /Immediate|IJ|Sev|CMS/);

const cmsJk = caFormatSeverityTag(
  def({ code: "F689", scope_severity_code: "J", immediate_jeopardy: true }),
);
assert.equal(cmsJk?.label, CMS_IJ_LABEL);

const azFlag = azFormatSeverityTag(
  def({ immediate_jeopardy: true, state_severity_raw: "Complete" }),
);
assert.equal(azFlag, null);

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
assert.equal(paOther, null);

const paCms = paFormatSeverityTag(
  def({
    code: "F0689",
    state_severity_raw: "Immediate Jeopardy",
    immediate_jeopardy: true,
  }),
);
assert.equal(paCms?.label, CMS_IJ_LABEL);

assert.equal(
  mnProfileConfig.formatSeverityTag(def({ scope_severity_code: "J", state_severity_raw: "SS=J", severity: 4 }))?.label,
  "SS J",
);
assert.equal(
  mnProfileConfig.formatSeverityTag(def({ scope_severity_code: "F", severity: 2 }))?.tone,
  "info",
);
assert.equal(
  mnProfileConfig.formatSeverityTag(def({ scope_severity_code: "G", state_severity_raw: "SS=G", severity: 3 }))?.label,
  "SS G",
);
assert.equal(
  mnProfileConfig.formatSeverityTag(def({ scope_severity_code: "G", severity: 3 }))?.tone,
  "danger",
);
assert.equal(
  utProfileConfig.formatSeverityTag(def({ state_severity_raw: "High", severity: 3 }))?.label,
  "High",
);
assert.equal(
  utProfileConfig.formatSeverityTag(def({ state_severity_raw: "Extreme", severity: 1 }))?.label,
  "Extreme",
);
assert.equal(
  waProfileConfig.formatSeverityTag(def({ state_severity_raw: "Type A", severity: 3 }))?.label,
  "Type A",
);
assert.equal(
  waProfileConfig.formatSeverityTag(def({ state_severity_raw: "Type B", severity: 4, immediate_jeopardy: true }))?.label,
  "Type B",
);
assert.equal(
  moProfileConfig.formatSeverityTag(def({ class: "Class I", severity: 2 }))?.label,
  "Class I",
);
assert.equal(
  paNhProfileConfig.formatSeverityTag(def({ scope_severity_code: "J", state_severity_raw: "Immediate Jeopardy" }))?.label,
  CMS_IJ_LABEL,
);
assert.equal(
  paNhProfileConfig.formatSeverityTag(def({ scope_severity_code: "D", state_severity_raw: "Civil Money Penalty" }))?.label,
  "CMS D",
);

assert.equal(
  isCmsImmediateJeopardy(def({ immediate_jeopardy: true, class: "Type A" })),
  false,
);
assert.equal(
  isCmsImmediateJeopardy(def({ code: "F689", scope_severity_code: "K" })),
  true,
);

console.log("severity label checks passed");

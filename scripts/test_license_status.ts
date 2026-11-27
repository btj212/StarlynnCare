import assert from "node:assert/strict";
import { formatLicenseStatus } from "../src/lib/facility/licenseStatus.ts";
import {
  displayWaLicense,
  padWaLicense,
  priorWaDshsFormsUrl,
  priorWaLicenseFromSlug,
} from "../src/lib/facility/waPriorLicense.ts";

assert.equal(formatLicenseStatus("LICENSED")?.label, "Licensed");
assert.equal(formatLicenseStatus("ON PROBATION")?.label, "Probationary license");
assert.equal(formatLicenseStatus("PROBATIONARY")?.label, "Probationary license");
assert.equal(formatLicenseStatus("CLOSED")?.label, "Closed");
assert.equal(formatLicenseStatus("PENDING")?.label, "Pending");
assert.equal(formatLicenseStatus("PDR-APPEAL PEND")?.label, "Provisional decision pending appeal");
assert.equal(formatLicenseStatus("closed")?.label, "Closed");
assert.equal(formatLicenseStatus(null), null);
assert.equal(formatLicenseStatus("ON PROBATION")?.notable, true);
assert.equal(formatLicenseStatus("LICENSED")?.notable, false);

assert.equal(padWaLicense("2141"), "0000002141");
assert.equal(displayWaLicense("0000002141"), "2141");
assert.equal(
  priorWaLicenseFromSlug("alpine-way-retirement-apartments-2141", "0000002801"),
  "0000002141",
);
assert.equal(
  priorWaLicenseFromSlug("the-lodge-at-arbor-village-2037", "0000002799"),
  "0000002037",
);
assert.equal(
  priorWaLicenseFromSlug("ashley-gardens-of-bremerton-1947", "0000002800"),
  "0000001947",
);
assert.equal(
  priorWaLicenseFromSlug("alpine-way-retirement-apartments-2141", "0000002141"),
  null,
);
assert.equal(priorWaLicenseFromSlug("some-home", "0000002801"), null);
assert.equal(
  priorWaDshsFormsUrl(
    "alpine-way-retirement-apartments-2141",
    "0000002801",
    "ALF",
  ),
  "https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic=2141",
);
assert.equal(
  priorWaDshsFormsUrl("alpine-way-retirement-apartments-2141", "0000002141", "ALF"),
  null,
);

console.log("license status checks passed");

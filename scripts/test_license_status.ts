import assert from "node:assert/strict";
import { formatLicenseStatus } from "../src/lib/facility/licenseStatus.ts";

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

console.log("license status checks passed");

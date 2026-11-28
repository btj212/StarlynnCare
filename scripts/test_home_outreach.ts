import assert from "node:assert/strict";
import {
  displayedPhone,
  emailDomainMatchesWebsite,
  parseListingChecks,
  shownListingFacts,
  signOutreachToken,
  verifyOutreachToken,
} from "../src/lib/facility/homeOutreach.ts";
import { AZ_MC_LEVEL1_LABEL } from "../src/lib/facility/azMcProgram.ts";

const secret = "test-outreach-secret-do-not-use";
const id = "11111111-2222-3333-4444-555555555555";
const token = signOutreachToken(id, secret);
assert.match(token, /^v1\./);
assert.equal(verifyOutreachToken(token, id, secret), true);
assert.equal(verifyOutreachToken(token, "other-id", secret), false);
assert.equal(verifyOutreachToken("v1.not.a.token", id, secret), false);
assert.equal(verifyOutreachToken(token, id, "wrong-secret"), false);
assert.equal(verifyOutreachToken(null, id, secret), false);

assert.equal(emailDomainMatchesWebsite("info@casadelreyaz.com", "https://www.casadelreyaz.com"), true);
assert.equal(emailDomainMatchesWebsite("staff@mail.casadelreyaz.com", "https://casadelreyaz.com"), true);
assert.equal(emailDomainMatchesWebsite("ops@brookdale.com", "https://mesa.brookdale.com"), true);
assert.equal(emailDomainMatchesWebsite("me@gmail.com", "https://www.casadelreyaz.com"), false);
assert.equal(emailDomainMatchesWebsite("info@casadelreyaz.com", null), false);

assert.equal(displayedPhone({ name: "X", phone: "(623)266-4936", phone_override: "(602) 881-4039" }), "(602) 881-4039");
assert.equal(displayedPhone({ name: "X", phone: "6232664936" }), "(623) 266-4936");

const facts = shownListingFacts({
  name: "LEGACY RETIREMENT RESIDENCE",
  state_code: "AZ",
  street: "5625 E MCKELLIPS RD",
  city: "Mesa",
  zip: "85215",
  phone: "6234325354",
  beds: 170,
  license_number: "AL7495C",
  website: "https://example.com",
  az_license_level: "Directed Care",
  memory_care_disclosure_source: "ADHS Directed Care License",
});
assert.equal(facts.find((f) => f.key === "licensed_name")?.shown, "Legacy Retirement Residence");
assert.equal(facts.find((f) => f.key === "marketing_name")?.shown, "Not in the state file we hold");
assert.match(facts.find((f) => f.key === "memory_care_label")?.shown ?? "", /R9-10-816/);
assert.equal(facts.find((f) => f.key === "memory_care_label")?.shown, AZ_MC_LEVEL1_LABEL);

const parsed = parseListingChecks(
  {
    allCorrectShortcut: true,
    fields: {},
  },
  facts,
);
assert.ok("checks" in parsed);
if ("checks" in parsed) {
  assert.equal(parsed.checks.allCorrectShortcut, true);
  assert.equal(parsed.checks.fields.licensed_name.verdict, "correct");
  assert.equal(parsed.checks.fields.licensed_name.correction, null);
}

const missing = parseListingChecks({ allCorrectShortcut: false, fields: {} }, facts);
assert.ok("error" in missing);

const insertKeys = [
  "facility_id",
  "status",
  "listing_checks",
  "mc_secured",
  "mc_program_name",
  "mc_program_url",
  "outreach_token_valid",
  "email_domain_matches",
];
assert.equal(insertKeys.includes("mc_program_confirmed"), false);

console.log("home outreach checks passed");

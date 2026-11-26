import assert from "node:assert/strict";
import {
  contentAliasFields,
  facilityAliases,
  facilityDisplayName,
  nameMatchesQuery,
} from "../src/lib/facility/aliases.ts";

const legalOnly = { name: "LEGACY RETIREMENT RESIDENCE" };
assert.equal(facilityAliases(legalOnly).marketingName, null);
assert.equal(facilityDisplayName(legalOnly), "Legacy Retirement Residence");
assert.equal(nameMatchesQuery(legalOnly, "legacy house of mesa"), false);
assert.equal(nameMatchesQuery(legalOnly, "legacy retirement"), true);

const sourced = {
  name: "LEGACY RETIREMENT RESIDENCE",
  marketing_name: "Legacy House of Mesa",
};
assert.equal(facilityAliases(sourced).marketingName, "Legacy House of Mesa");
assert.equal(facilityDisplayName(sourced), "Legacy House of Mesa");
assert.equal(nameMatchesQuery(sourced, "legacy house of mesa"), true);

const fromContent = {
  name: "LEGAL NAME HOME",
  content: { marketing_name: "Sunset Villa", name_aliases: ["Old Sunset"] },
};
assert.equal(facilityDisplayName(fromContent), "Sunset Villa");
assert.equal(nameMatchesQuery(fromContent, "old sunset"), true);

assert.deepEqual(contentAliasFields(null), { marketing_name: null, name_aliases: null });
assert.deepEqual(contentAliasFields({ marketing_name: "A", name_aliases: ["B"] }), {
  marketing_name: "A",
  name_aliases: ["B"],
});

console.log("alias checks passed");

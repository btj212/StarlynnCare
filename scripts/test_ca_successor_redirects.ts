import assert from "node:assert/strict";
import { CA_SUCCESSOR_REDIRECTS } from "../src/lib/redirects/caSuccessorRedirects.ts";

const sources = new Set<string>();
for (const r of CA_SUCCESSOR_REDIRECTS) {
  assert.match(r.source, /^\/california\/[a-z0-9-]+\/[a-z0-9-]+$/);
  assert.match(r.destination, /^\/california\/[a-z0-9-]+\/[a-z0-9-]+$/);
  assert.notEqual(r.source, r.destination);
  assert.notEqual(r.oldLicense, r.newLicense);
  assert.ok(!sources.has(r.source), `duplicate source ${r.source}`);
  sources.add(r.source);
}
// No chains: a destination is never itself redirected.
for (const r of CA_SUCCESSOR_REDIRECTS) assert.ok(!sources.has(r.destination));
assert.equal(CA_SUCCESSOR_REDIRECTS.length, 37);
console.log(`ca successor redirects ok (${CA_SUCCESSOR_REDIRECTS.length})`);

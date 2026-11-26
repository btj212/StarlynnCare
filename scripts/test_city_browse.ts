import assert from "node:assert/strict";
import {
  cityBrowseHubPath,
  cityBrowseIsFiltered,
  cityBrowsePageNumber,
} from "../src/lib/seo/cityBrowse.ts";

assert.equal(cityBrowsePageNumber(undefined), 1);
assert.equal(cityBrowsePageNumber("1"), 1);
assert.equal(cityBrowsePageNumber("0"), 1);
assert.equal(cityBrowsePageNumber("abc"), 1);
assert.equal(cityBrowsePageNumber("2"), 2);

assert.equal(cityBrowseIsFiltered({}), false);
assert.equal(cityBrowseIsFiltered({ page: "1" }), false);
assert.equal(cityBrowseIsFiltered({ q: "" }), false);
assert.equal(cityBrowseIsFiltered({ q: "   " }), false);
assert.equal(cityBrowseIsFiltered({ homes: "all" }), false);

assert.equal(cityBrowseIsFiltered({ page: "2" }), true);
assert.equal(cityBrowseIsFiltered({ q: "sunrise" }), true);
assert.equal(cityBrowseIsFiltered({ homes: "small" }), true);
assert.equal(cityBrowseIsFiltered({ page: "2", q: "sunrise", homes: "small" }), true);

assert.equal(cityBrowseHubPath("california", "san-diego"), "/california/san-diego");
assert.equal(cityBrowseHubPath("illinois", "chicago"), "/illinois/chicago");

console.log("city browse canonical checks passed");

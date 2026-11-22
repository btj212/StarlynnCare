import assert from "node:assert/strict";
import {
  TEMPLATE_CHANGED,
  latestContentDate,
  renderSitemapIndex,
  withTemplateFloor,
} from "../src/lib/sitemap/buildSitemapEntries.ts";

const today = new Date().toISOString().slice(0, 10);
const xml = renderSitemapIndex([
  { path: "/sitemap-static.xml", lastmod: "2026-10-22" },
  { path: "/sitemap-hubs.xml" },
  { path: "/sitemap-facilities.xml", lastmod: "2026-08-04" },
]);

assert.equal(xml.includes(`<lastmod>${today}</lastmod>`), false);
assert.match(xml, /sitemap-static\.xml<\/loc>\s*<lastmod>2026-10-22<\/lastmod>/);
assert.doesNotMatch(xml, /sitemap-hubs\.xml<\/loc>\s*<lastmod>/);
assert.equal(
  latestContentDate([
    { loc: "https://www.starlynncare.com/arizona", priority: "0.8", changefreq: "weekly" },
    {
      loc: "https://www.starlynncare.com/california",
      priority: "0.8",
      changefreq: "weekly",
      lastmod: "2026-10-22",
    },
  ]),
  "2026-10-22",
);
assert.equal(
  latestContentDate([
    { loc: "https://www.starlynncare.com/about", priority: "0.5", changefreq: "monthly" },
  ]),
  undefined,
);

// A row not re-ingested since June still prints the redesigned page, so its
// date is the release date. A row updated after the release keeps its own date.
assert.equal(withTemplateFloor("2026-06-15", TEMPLATE_CHANGED.facility), "2026-11-17");
assert.equal(withTemplateFloor(undefined, TEMPLATE_CHANGED.facility), "2026-11-17");
assert.equal(withTemplateFloor("2026-11-20", TEMPLATE_CHANGED.facility), "2026-11-20");

console.log("sitemap lastmod checks passed");

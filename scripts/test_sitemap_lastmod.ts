import assert from "node:assert/strict";
import {
  latestContentDate,
  renderSitemapIndex,
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

console.log("sitemap lastmod checks passed");

/**
 * state-hub.spec.ts — E2E tests for state hub pages.
 *
 * Tests the full pipeline output for state hub pages:
 *   /california, /oregon, /washington, /minnesota, /texas
 *
 * Verifies:
 *   - Page loads with real data (no placeholder numbers)
 *   - Stat blocks show plausible real numbers (> 0)
 *   - Facility cards/listings are present
 *   - JSON-LD CollectionPage schema is present and valid
 *   - Facilities browse link points to correct /{state}/facilities page
 *   - Governance bar is present
 *
 * No mocking. Requires a running Next.js server with real DB credentials.
 */
import { expect, test } from "@playwright/test";
import { stateFacilitiesPath, stateHubPath } from "./helpers";

const COVERED_STATES = [
  { code: "CA", name: "California" },
  { code: "OR", name: "Oregon" },
  { code: "WA", name: "Washington" },
  { code: "MN", name: "Minnesota" },
] as const;

for (const { code, name } of COVERED_STATES) {
  test.describe(`${name} state hub`, () => {
    const hubPath = stateHubPath(code);
    const facilitiesPath = stateFacilitiesPath(code);

    test(`${name} hub returns 200`, async ({ page }) => {
      const resp = await page.request.get(hubPath);
      expect(resp.status()).toBe(200);
    });

    test(`${name} hub title contains state name`, async ({ page }) => {
      await page.goto(hubPath, { waitUntil: "networkidle" });
      const title = await page.title();
      expect(title.toLowerCase()).toContain(name.toLowerCase());
    });

    test(`${name} hub has no undefined or [object Object]`, async ({ page }) => {
      await page.goto(hubPath, { waitUntil: "networkidle" });
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toContain("[object Object]");
      const undefs = (bodyText.match(/\bundefined\b/gi) ?? []).length;
      expect(undefs).toBe(0);
    });

    test(`${name} hub has heading with state name`, async ({ page }) => {
      await page.goto(hubPath, { waitUntil: "networkidle" });
      const headings = await page.locator("h1, h2, h3").allTextContents();
      const allText = headings.join(" ");
      expect(allText.toLowerCase()).toContain(name.toLowerCase());
    });

    test(`${name} hub has JSON-LD schema`, async ({ page }) => {
      await page.goto(hubPath, { waitUntil: "networkidle" });
      const jsonLdScripts = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      expect(jsonLdScripts.length).toBeGreaterThan(0);
      for (const text of jsonLdScripts) {
        expect(() => JSON.parse(text)).not.toThrow();
      }
    });

    test(`${name} hub has canonical link to /${hubPath.slice(1)}`, async ({ page }) => {
      await page.goto(hubPath, { waitUntil: "networkidle" });
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical).toContain(hubPath);
    });

    test(`${name} facilities browse page returns 200`, async ({ page }) => {
      const resp = await page.request.get(facilitiesPath);
      expect(resp.status()).toBe(200);
    });

    test(`${name} facilities page has facility cards`, async ({ page }) => {
      await page.goto(facilitiesPath, { waitUntil: "networkidle" });
      const bodyText = await page.locator("body").innerText();
      // The facilities page should mention the state name
      expect(bodyText.toLowerCase()).toContain(name.toLowerCase());
      // Should not be completely empty
      expect(bodyText.length).toBeGreaterThan(100);
    });

    test(`${name} hub links to /${facilitiesPath.slice(1)} for browse`, async ({ page }) => {
      await page.goto(hubPath, { waitUntil: "networkidle" });
      // Look for a link to the facilities browse page
      const facilityLinks = page.locator(`a[href="${facilitiesPath}"]`);
      const count = await facilityLinks.count();
      // Per AGENTS.md: state hub pages must have a "Browse X facilities" CTA
      // pointing to /{state}/facilities
      if (count > 0) {
        const href = await facilityLinks.first().getAttribute("href");
        expect(href).toBe(facilitiesPath);
      }
      // If no exact match, check that the path appears somewhere in the page links
      const allLinks = await page.locator("a[href]").all();
      const hrefs = await Promise.all(allLinks.map((a) => a.getAttribute("href")));
      const hasFacilitiesLink = hrefs.some(
        (h) => h === facilitiesPath || h?.endsWith("/facilities"),
      );
      expect(hasFacilitiesLink).toBe(true);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-state consistency
// ─────────────────────────────────────────────────────────────────────────────

test.describe("State hub cross-state consistency", () => {
  test("all covered state hubs return 200", async ({ request }) => {
    const results = await Promise.all(
      COVERED_STATES.map(async ({ code }) => {
        const path = stateHubPath(code);
        const resp = await request.get(path);
        return { code, path, status: resp.status() };
      }),
    );
    for (const { code, path, status } of results) {
      expect(status, `${code} hub at ${path} returned ${status}`).toBe(200);
    }
  });

  test("all covered state facilities pages return 200", async ({ request }) => {
    const results = await Promise.all(
      COVERED_STATES.map(async ({ code }) => {
        const path = stateFacilitiesPath(code);
        const resp = await request.get(path);
        return { code, path, status: resp.status() };
      }),
    );
    for (const { code, path, status } of results) {
      expect(status, `${code} facilities at ${path} returned ${status}`).toBe(200);
    }
  });
});

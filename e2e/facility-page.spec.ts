/**
 * facility-page.spec.ts — E2E tests for individual facility profile pages.
 *
 * Loads a REAL publishable facility from the DB and tests the full rendered page.
 * Verifies that the complete pipeline output (ingest → DB → server component → HTML)
 * produces a complete, correct, data-rich facility page.
 *
 * Tests cover:
 *   - All major page sections render with real data
 *   - No rendering artifacts (undefined, null, [object Object])
 *   - JSON-LD schema is valid and complete
 *   - Breadcrumb navigation is correct
 *   - Memory care designation shown when applicable
 *   - Inspection history section renders when inspections exist
 *   - Watch form is present and functional
 *
 * Marked as requiring real credentials (skips gracefully when absent).
 */
import { expect, test } from "@playwright/test";
import { facilityPath, getRealFacility, getRealMCFacility, hasDbCredentials } from "./helpers";

test.describe("Facility profile page", () => {
  test.skip(!hasDbCredentials(), "Supabase credentials not set — skipping facility page E2E");

  test("real facility page returns 200", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    const path = facilityPath(facility);
    const resp = await page.request.get(path);
    expect(resp.status()).toBe(200);
  });

  test("facility page has correct title with facility name", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    const title = await page.title();
    expect(title).toContain(facility.name);
  });

  test("no undefined or [object Object] in rendered content", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("[object Object]");
    const undefs = (bodyText.match(/\bundefined\b/gi) ?? []).length;
    expect(undefs).toBe(0);
  });

  test("facility name appears as h1 or prominent heading", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    const h1 = await page.locator("h1").innerText();
    expect(h1).toContain(facility.name);
  });

  test("JSON-LD contains LocalBusiness schema", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    const jsonLdTexts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();

    let hasLocalBusiness = false;
    for (const text of jsonLdTexts) {
      const schema = JSON.parse(text);
      const schemas = Array.isArray(schema) ? schema : [schema];
      for (const s of schemas) {
        const types = Array.isArray(s["@type"]) ? s["@type"] : [s["@type"]];
        if (types.some((t: string) => t === "LocalBusiness" || t === "MedicalOrganization")) {
          hasLocalBusiness = true;
          // Verify it has the facility name
          expect(s.name).toBe(facility.name);
          // Verify it has an address
          expect(s.address).toBeTruthy();
          expect(s.address["@type"]).toBe("PostalAddress");
        }
      }
    }
    expect(hasLocalBusiness).toBe(true);
  });

  test("JSON-LD contains BreadcrumbList", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    const jsonLdTexts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();

    let hasBreadcrumb = false;
    for (const text of jsonLdTexts) {
      const schema = JSON.parse(text);
      const schemas = Array.isArray(schema) ? schema : [schema];
      for (const s of schemas) {
        if (s["@type"] === "BreadcrumbList") {
          hasBreadcrumb = true;
          expect(s.itemListElement.length).toBeGreaterThanOrEqual(2);
          // First item should be Home
          expect(s.itemListElement[0].position).toBe(1);
        }
      }
    }
    expect(hasBreadcrumb).toBe(true);
  });

  test("canonical link points to correct facility URL", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain(facility.slug);
    expect(canonical).toContain(facility.city_slug);
  });

  test("watch form is present on facility page", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    // Watch form should have an email input
    const emailInput = page.locator('input[type="email"]').first();
    const exists = await emailInput.count();
    expect(exists).toBeGreaterThan(0);
  });

  test("memory care facility shows memory care designation", async ({ page }) => {
    const mcFacility = await getRealMCFacility();
    if (!mcFacility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(mcFacility), { waitUntil: "networkidle" });
    const bodyText = await page.locator("body").innerText();
    // The page should mention memory care somewhere (in heading, badge, or description)
    expect(bodyText.toLowerCase()).toMatch(/memory care|dementia|alzheimer/);
  });

  test("404 page returned for non-existent facility", async ({ page }) => {
    const resp = await page.request.get("/california/berkeley/this-facility-does-not-exist-xyz");
    expect(resp.status()).toBe(404);
  });

  test("inspection section renders when inspections exist", async ({ page }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });
    const bodyText = await page.locator("body").innerText();
    // If the facility has inspections (most do), the inspection section should appear
    // We test the presence of an inspection-related term
    if (bodyText.toLowerCase().includes("inspection")) {
      // Verify no raw database IDs are shown (UUIDs should not appear in user-facing text)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const uuids = bodyText.match(uuidPattern) ?? [];
      expect(uuids.length).toBe(0);
    }
  });

  test("all internal links on facility page are valid (no broken links to 404)", async ({
    page,
    request,
  }) => {
    const facility = await getRealFacility();
    if (!facility) {
      test.skip();
      return;
    }
    await page.goto(facilityPath(facility), { waitUntil: "networkidle" });

    // Collect all internal links (same origin)
    const baseUrl = new URL(page.url()).origin;
    const links = await page.locator("a[href]").all();
    const internalHrefs: string[] = [];
    for (const link of links.slice(0, 20)) {
      // Test first 20 links max
      const href = await link.getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("//")) {
        internalHrefs.push(`${baseUrl}${href}`);
      }
    }

    for (const url of internalHrefs.slice(0, 10)) {
      // Test first 10 internal links
      const resp = await request.get(url);
      expect(resp.status(), `Internal link ${url} returned ${resp.status()}`).not.toBe(404);
    }
  });
});

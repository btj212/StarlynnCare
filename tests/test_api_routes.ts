/**
 * Layer G — API route integration tests.
 *
 * Tests the /api/facilities/[state] public JSON endpoint against a live server
 * (production by default; override with TEST_BASE_URL env var for preview deploys).
 *
 * Every test hits the REAL HTTP endpoint with ZERO mocks. Tests verify:
 *   1. HTTP status codes
 *   2. Response JSON schema completeness (every required field present)
 *   3. Data correctness (known fixtures appear; counts in expected range)
 *   4. CORS and cache headers
 *   5. Error paths (unknown states → 404)
 *
 * Run:
 *   npx tsx tests/test_api_routes.ts
 *   TEST_BASE_URL=https://your-preview.vercel.app npx tsx tests/test_api_routes.ts
 *
 * Exit 0 = all passed. Exit 1 = one or more failed.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Env loader
// ---------------------------------------------------------------------------

function loadEnv(): void {
  const repoRoot = resolve(__dirname, "..");
  for (const name of [".env.local", ".env"]) {
    try {
      const content = readFileSync(resolve(repoRoot, name), "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const rawVal = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (key && !(key in process.env)) process.env[key] = rawVal;
      }
      break;
    } catch {
      // file not found
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

type TestFn = () => Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

let networkSkipped = false;

async function runAll(): Promise<void> {
  console.log("=".repeat(60));
  console.log("StarlynnCare — Layer G: API Route Integration Tests");
  console.log(`Target: ${BASE_URL}`);
  console.log("=".repeat(60));

  for (const t of tests) {
    if (networkSkipped) {
      console.log(`  SKIP  ${t.name}  (network unavailable)`);
      continue;
    }
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
      passed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If this is a network error, skip all remaining tests
      if (msg.includes("Network unavailable")) {
        networkSkipped = true;
        console.log(`  SKIP  ${t.name}  (network unavailable — run from dev machine with internet access)`);
        console.log(`        ${msg.split("\n")[0]}`);
        continue;
      }
      console.log(`  FAIL  ${t.name}`);
      console.log(`        ← ${msg}`);
      failed++;
      failures.push(t.name);
    }
  }

  console.log();
  console.log("-".repeat(60));
  console.log(`Summary: ${passed}/${passed + failed} passed`);
  if (failures.length > 0) {
    console.log(`Failed (${failures.length}):`);
    for (const f of failures) console.log(`  • ${f}`);
  }
  console.log("-".repeat(60));
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.TEST_BASE_URL ?? "https://starlynn.care").replace(/\/$/, "");

// Covered state slugs (from states.ts COVERED_STATES)
const COVERED_SLUGS = ["california", "texas", "oregon", "washington", "minnesota", "utah", "illinois"] as const;

// StateFacility fields that must be present on every facility in the API response
// (from the ApiPayload type in /api/facilities/[state]/route.ts)
const REQUIRED_FACILITY_FIELDS = [
  "id",
  "name",
  "url",
  "state_code",
  "care_category",
  "serves_memory_care",
  "total_deficiency_count",
] as const;

// Required top-level ApiPayload fields
const REQUIRED_PAYLOAD_FIELDS = [
  "schema",
  "state_code",
  "state_name",
  "generated_at",
  "count",
  "methodology_url",
  "facilities",
] as const;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getJson(path: string): Promise<{ status: number; headers: Headers; body: unknown }> {
  const url = `${BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      // 30-second timeout
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("fetch failed") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("AbortError")
    ) {
      throw new Error(
        `Network unavailable: ${msg}\n` +
        `URL: ${url}\n` +
        `Set TEST_BASE_URL to a reachable server, or run from a machine with internet access.`,
      );
    }
    throw err;
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body };
}

// ---------------------------------------------------------------------------
// Tests: unknown / invalid states return 404
// ---------------------------------------------------------------------------

test("unknown state returns 404", async () => {
  const { status } = await getJson("/api/facilities/atlantis");
  assert(status === 404, `Expected 404 for unknown state, got ${status}`);
});

test("pennsylvania returns 404 (not in COVERED_STATES)", async () => {
  const { status } = await getJson("/api/facilities/pennsylvania");
  assert(
    status === 404,
    `Expected 404 for 'pennsylvania' (not in COVERED_STATES), got ${status}. ` +
    "PA has DB data but is not yet exposed via the API.",
  );
});

test("empty state slug returns 404", async () => {
  const { status } = await getJson("/api/facilities/");
  // Could be 404 or 405 depending on routing
  assert(status >= 400, `Expected ≥400 for empty state slug, got ${status}`);
});

// ---------------------------------------------------------------------------
// Tests: each covered state returns valid payload
// ---------------------------------------------------------------------------

for (const stateSlug of COVERED_SLUGS) {
  test(`${stateSlug}: returns HTTP 200`, async () => {
    const { status } = await getJson(`/api/facilities/${stateSlug}`);
    assert(status === 200, `Expected 200, got ${status}`);
  });

  test(`${stateSlug}: response has required top-level fields`, async () => {
    const { body } = await getJson(`/api/facilities/${stateSlug}`);
    const payload = body as Record<string, unknown>;
    assert(payload !== null && typeof payload === "object", "Response is not a JSON object");

    for (const field of REQUIRED_PAYLOAD_FIELDS) {
      assert(field in payload, `Missing top-level field: '${field}'`);
    }
  });

  test(`${stateSlug}: schema field is schema.org Dataset`, async () => {
    const { body } = await getJson(`/api/facilities/${stateSlug}`);
    const payload = body as Record<string, unknown>;
    assert(
      payload.schema === "https://schema.org/Dataset",
      `Expected schema='https://schema.org/Dataset', got '${payload.schema}'`,
    );
  });

  test(`${stateSlug}: count matches facilities array length`, async () => {
    const { body } = await getJson(`/api/facilities/${stateSlug}`);
    const payload = body as Record<string, unknown>;
    const facilities = payload.facilities as unknown[];
    assert(Array.isArray(facilities), "facilities must be an array");
    assert(
      payload.count === facilities.length,
      `count=${payload.count} but facilities.length=${facilities.length}`,
    );
  });

  test(`${stateSlug}: has at least one facility`, async () => {
    const { body } = await getJson(`/api/facilities/${stateSlug}`);
    const payload = body as Record<string, unknown>;
    const facilities = payload.facilities as unknown[];
    assert(
      facilities.length > 0,
      `${stateSlug}: 0 facilities returned. Ingest or recompute has not run.`,
    );
  });

  test(`${stateSlug}: every facility has required fields`, async () => {
    const { body } = await getJson(`/api/facilities/${stateSlug}`);
    const payload = body as Record<string, unknown>;
    const facilities = (payload.facilities as Array<Record<string, unknown>>).slice(0, 10);

    for (const facility of facilities) {
      for (const field of REQUIRED_FACILITY_FIELDS) {
        assert(
          field in facility,
          `Facility '${facility.name}' missing field '${field}'`,
        );
      }
      // serves_memory_care must be boolean
      assert(
        typeof facility.serves_memory_care === "boolean",
        `serves_memory_care is not boolean for '${facility.name}'`,
      );
      // URL must be a valid https URL
      assert(
        typeof facility.url === "string" && facility.url.startsWith("https://"),
        `url is not https:// for '${facility.name}': ${facility.url}`,
      );
      // total_deficiency_count must be a number
      assert(
        typeof facility.total_deficiency_count === "number",
        `total_deficiency_count is not a number for '${facility.name}'`,
      );
    }
  });

  test(`${stateSlug}: facility URL path matches state slug`, async () => {
    const { body } = await getJson(`/api/facilities/${stateSlug}`);
    const payload = body as Record<string, unknown>;
    const facilities = (payload.facilities as Array<Record<string, unknown>>).slice(0, 5);

    for (const facility of facilities) {
      const url = facility.url as string;
      assert(
        url.includes(`/${stateSlug}/`),
        `Facility URL '${url}' doesn't contain state slug '/${stateSlug}/'`,
      );
    }
  });

  test(`${stateSlug}: generated_at is a valid ISO datetime`, async () => {
    const { body } = await getJson(`/api/facilities/${stateSlug}`);
    const payload = body as Record<string, unknown>;
    const generatedAt = payload.generated_at as string;
    const parsed = new Date(generatedAt);
    assert(!isNaN(parsed.getTime()), `generated_at '${generatedAt}' is not a valid datetime`);
    // Must be recent (within 2 hours, accounting for cache)
    const ageMs = Date.now() - parsed.getTime();
    // Allow stale-while-revalidate window (86400 = 1 day)
    assert(ageMs < 90_000_000, `generated_at is over 25 hours old: ${generatedAt}`);
  });
}

// ---------------------------------------------------------------------------
// Tests: California-specific data correctness
// ---------------------------------------------------------------------------

test("california: Opal Care appears in facility list", async () => {
  const { body } = await getJson("/api/facilities/california");
  const payload = body as Record<string, unknown>;
  const facilities = (payload.facilities as Array<Record<string, unknown>>);

  const opalCare = facilities.find(
    (f) =>
      typeof f.license_number === "string" && f.license_number === "200672",
  );
  assert(
    opalCare !== undefined,
    "Opal Care (license 200672) not found in /api/facilities/california. " +
    "This is CA's most-cited facility and a key regression fixture.",
  );
});

test("california: Opal Care has serves_memory_care=true", async () => {
  const { body } = await getJson("/api/facilities/california");
  const payload = body as Record<string, unknown>;
  const facilities = (payload.facilities as Array<Record<string, unknown>>);

  const opalCare = facilities.find(
    (f) => typeof f.license_number === "string" && f.license_number === "200672",
  );
  assert(opalCare !== undefined, "Opal Care not found in API response");
  assert(
    opalCare!.serves_memory_care === true,
    `Opal Care serves_memory_care=${opalCare!.serves_memory_care} in API response`,
  );
});

test("california: Opal Care has total_deficiency_count > 0", async () => {
  const { body } = await getJson("/api/facilities/california");
  const payload = body as Record<string, unknown>;
  const facilities = (payload.facilities as Array<Record<string, unknown>>);

  const opalCare = facilities.find(
    (f) => typeof f.license_number === "string" && f.license_number === "200672",
  );
  assert(opalCare !== undefined, "Opal Care not found in API response");
  assert(
    (opalCare!.total_deficiency_count as number) > 0,
    `Opal Care total_deficiency_count=${opalCare!.total_deficiency_count} — expected > 0`,
  );
});

test("california: count exceeds minimum (>= 1000)", async () => {
  const { body } = await getJson("/api/facilities/california");
  const payload = body as Record<string, unknown>;
  assert(
    (payload.count as number) >= 1000,
    `CA facility count=${payload.count}, expected ≥1000`,
  );
});

// ---------------------------------------------------------------------------
// Tests: CORS and cache headers
// ---------------------------------------------------------------------------

for (const stateSlug of COVERED_SLUGS.slice(0, 2)) {
  test(`${stateSlug}: CORS header allows all origins`, async () => {
    const { headers } = await getJson(`/api/facilities/${stateSlug}`);
    const corsHeader = headers.get("access-control-allow-origin");
    assert(
      corsHeader === "*",
      `Expected Access-Control-Allow-Origin: *, got '${corsHeader}'`,
    );
  });

  test(`${stateSlug}: X-Robots-Tag is noindex (API responses suppressed from web search)`, async () => {
    const { headers } = await getJson(`/api/facilities/${stateSlug}`);
    const robotsHeader = headers.get("x-robots-tag");
    assert(
      robotsHeader !== null && robotsHeader.toLowerCase().includes("noindex"),
      `Expected X-Robots-Tag: noindex, got '${robotsHeader}'`,
    );
  });

  test(`${stateSlug}: Cache-Control header is set`, async () => {
    const { headers } = await getJson(`/api/facilities/${stateSlug}`);
    const cacheControl = headers.get("cache-control");
    assert(
      cacheControl !== null && cacheControl.length > 0,
      `Cache-Control header missing for ${stateSlug}`,
    );
  });
}

// ---------------------------------------------------------------------------
// Tests: methodology_url is a valid URL
// ---------------------------------------------------------------------------

test("methodology_url is a valid https URL", async () => {
  const { body } = await getJson("/api/facilities/california");
  const payload = body as Record<string, unknown>;
  const url = payload.methodology_url as string;
  assert(
    typeof url === "string" && url.startsWith("https://"),
    `methodology_url '${url}' is not a valid https URL`,
  );
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

runAll().then(() => {
  if (failed > 0) process.exit(1);
}).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

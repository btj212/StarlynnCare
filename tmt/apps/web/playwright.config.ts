import { defineConfig, devices } from "@playwright/test";

const port = 3210;
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_SERVER === undefined
    ? !process.env.CI
    : process.env.PLAYWRIGHT_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${String(port)}`,
    env: {
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid",
      PUBLIC_WEB_BASE_URL: baseURL,
      TMT_WEB_FIXTURE_MODE: "test",
    },
    reuseExistingServer,
    timeout: 120_000,
    url: `${baseURL}/en`,
  },
});

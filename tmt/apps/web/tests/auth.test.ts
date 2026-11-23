import { describe, expect, it, vi } from "vitest";
import {
  magicLinkCallbackUrl,
  requestMagicLink,
  safeNextPath,
} from "../lib/auth";
import { isFixtureMode, publicSupabaseEnv } from "../lib/env";

describe("magic-link auth helpers", () => {
  it("builds a locale-scoped callback without creating users", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const sent = await requestMagicLink(
      { auth: { signInWithOtp } },
      " Dispatcher@Example.com ",
      "pa",
      "https://tmt.example",
    );

    expect(sent).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "dispatcher@example.com",
      options: {
        emailRedirectTo:
          "https://tmt.example/auth/callback?next=%2Fpa%2Fops",
        shouldCreateUser: false,
      },
    });
  });

  it("rejects malformed emails before calling Supabase", async () => {
    const signInWithOtp = vi.fn();
    await expect(
      requestMagicLink(
        { auth: { signInWithOtp } },
        "not-an-email",
        "en",
        "https://tmt.example",
      ),
    ).resolves.toBe(false);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("keeps callback redirects on this origin", () => {
    expect(safeNextPath("https://bad.example")).toBe("/en/ops");
    expect(safeNextPath("//bad.example")).toBe("/en/ops");
    expect(safeNextPath("/es/ops")).toBe("/es/ops");
    expect(magicLinkCallbackUrl("https://tmt.example", "hi")).toContain(
      "next=%2Fhi%2Fops",
    );
  });
});

describe("test fixture guard", () => {
  it("requires an explicit test value and refuses production", () => {
    expect(isFixtureMode({ NODE_ENV: "test" })).toBe(false);
    expect(
      isFixtureMode({
        NODE_ENV: "test",
        TMT_WEB_FIXTURE_MODE: "test",
      }),
    ).toBe(true);
    expect(() =>
      isFixtureMode({
        NODE_ENV: "production",
        TMT_WEB_FIXTURE_MODE: "test",
      }),
    ).toThrow("disabled in production");
    expect(() =>
      isFixtureMode({
        NODE_ENV: "test",
        TMT_WEB_FIXTURE_MODE: "true",
      }),
    ).toThrow('exactly "test"');
  });

  it("requires only the browser-safe Supabase values", () => {
    expect(
      publicSupabaseEnv({
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "public-anon",
    });
  });
});

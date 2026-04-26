import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "StarlynnCare — Coming Soon",
  robots: { index: false, follow: false },
};

async function unlock(formData: FormData) {
  "use server";
  const password = formData.get("password") as string;
  const from = (formData.get("from") as string) || "/";
  const sitePassword = process.env.SITE_UNLOCK_PASSWORD;

  if (sitePassword && password === sitePassword) {
    const cookieStore = await cookies();
    cookieStore.set("sl_auth", sitePassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    redirect(from.startsWith("/") ? from : "/");
  }

  // Wrong password — bounce back with error flag
  redirect(`/unlock?from=${encodeURIComponent(from)}&error=1`);
}

type Props = { searchParams: Promise<{ from?: string; error?: string }> };

export default async function UnlockPage({ searchParams }: Props) {
  const { from = "/", error } = await searchParams;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--color-paper)", fontFamily: "var(--font-sans)" }}
    >
      <div className="w-full max-w-[380px]">
        {/* Brand */}
        <div
          className="mb-10 text-center font-[family-name:var(--font-display)] text-[32px] tracking-[-0.01em]"
          style={{ color: "var(--color-ink)" }}
        >
          StarlynnCare
        </div>

        <div
          className="rounded-xl border px-8 py-8"
          style={{ borderColor: "var(--color-paper-rule)", background: "var(--color-paper-2)" }}
        >
          <p
            className="text-[15px] leading-relaxed mb-6 text-center"
            style={{ color: "var(--color-ink-2)" }}
          >
            This site is in private preview. Enter the access password to continue.
          </p>

          <form action={unlock}>
            <input type="hidden" name="from" value={from} />

            <input
              type="password"
              name="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              className="w-full border rounded-lg px-4 py-3 text-[15px] outline-none mb-3"
              style={{
                borderColor: error ? "var(--color-rust)" : "var(--color-paper-rule)",
                background: "var(--color-paper)",
                color: "var(--color-ink)",
              }}
            />

            {error && (
              <p
                className="text-[13px] mb-3"
                style={{ color: "var(--color-rust)" }}
              >
                Incorrect password — please try again.
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg px-4 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-ink)" }}
            >
              Enter
            </button>
          </form>
        </div>

        <p
          className="mt-8 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "var(--color-ink-4)" }}
        >
          California memory care · inspection data
        </p>
      </div>
    </div>
  );
}

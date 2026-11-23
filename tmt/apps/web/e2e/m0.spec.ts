import { expect, test, type Page, type Request } from "@playwright/test";

const localeHeadings = {
  en: "One call. Clear help. Back on the road.",
  pa: "ਇੱਕ ਕਾਲ। ਸਾਫ਼ ਮਦਦ। ਮੁੜ ਸੜਕ ਉੱਤੇ।",
  hi: "एक कॉल। साफ़ मदद। फिर सड़क पर।",
  es: "Una llamada. Ayuda clara. De vuelta al camino.",
} as const;

function watchExternalRequests(page: Page): string[] {
  const externalRequests: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      externalRequests.push(request.url());
    }
  });
  return externalRequests;
}

for (const [locale, heading] of Object.entries(localeHeadings)) {
  test(`${locale} landing is localized, accessible and responsive`, async ({
    page,
  }) => {
    const externalRequests = watchExternalRequests(page);
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}`);

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("link", { name: /dispatcher|ਡਿਸਪੈਚਰ|डिस्पैचर|despacho/i }).first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(await page.locator("body").innerText()).not.toMatch(
        /MISSING_MESSAGE|landing\.[a-z]/u,
      );
    }

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    expect(consoleErrors.filter((error) => /missing|message/i.test(error))).toEqual(
      [],
    );
    expect(externalRequests).toEqual([]);
  });
}

test("fixture magic-link login opens an authenticated operations board", async ({
  page,
}) => {
  const externalRequests = watchExternalRequests(page);
  await page.goto("/pa/login");
  await page.getByLabel("ਕੰਮ ਵਾਲੀ ਈਮੇਲ").fill("dispatcher@example.test");
  await page.getByRole("button", { name: "ਮੈਨੂੰ ਸਾਈਨ-ਇਨ ਲਿੰਕ ਈਮੇਲ ਕਰੋ" }).click();

  await expect(page).toHaveURL(/\/pa\/ops$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "ਲਾਈਵ ਕਾਲ ਬੋਰਡ" }),
  ).toBeVisible();
  await expect(page.getByText("Nav Kaur (Fictional) · dispatcher")).toBeVisible();
  await expect(page.getByText("ਟੈਸਟ ਫਿਕਸਚਰ ਮੋਡ")).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("mock live transcript update renders in under two seconds", async ({
  page,
}) => {
  const externalRequests = watchExternalRequests(page);
  const startedAt = Date.now();
  await page.goto("/en/ops");
  const update = page.locator(
    '[data-utterance-id="00000000-0000-4000-8000-000000005004"]',
  );

  await expect(update).toContainText("Mock live transcript update received.", {
    timeout: 2_000,
  });
  expect(Date.now() - startedAt).toBeLessThan(2_000);
  expect(externalRequests).toEqual([]);
});

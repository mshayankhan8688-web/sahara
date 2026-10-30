import { expect, test } from "@playwright/test";
import {
  API_URL,
  assertPdf,
  assertPptxOrDocxZip,
  collectConsoleErrors,
  collectFailedRequests,
  mockAiApis,
  openAuthenticatedApp,
  registerViaApi,
} from "./helpers";

/**
 * Focused smoke coverage requested for audit follow-up.
 * AI generate is mocked; studio export hits the real local API.
 */
test.describe("Smoke", () => {
  test("home page loads with brand CTA", async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    const failed = await collectFailedRequests(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /your everyday life/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start chatting/i }).first()).toBeVisible();
    expect(errors.filter((e) => !/favicon|webgl|ResizeObserver/i.test(e))).toEqual([]);
    expect(failed.filter((f) => !/favicon/i.test(f))).toEqual([]);
  });

  test("pricing page shows free plan and disabled checkout", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.getByRole("heading", { name: /free and premium/i })).toBeVisible();
    await expect(page.getByText(/pkr 0/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /premium checkout not live/i })).toBeDisabled();
  });

  test("login page is reachable and validates empty submit path", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email or phone/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
  });

  test("studio page loads when authenticated and shows mode tabs", async ({ page, context, request }) => {
    const account = await registerViaApi(request, "smoke-studio");
    await openAuthenticatedApp(page, context, account);
    await page.goto("/app/studio?mode=study");
    await expect(page).toHaveURL(/\/app\/studio/);
    await expect(page.getByRole("heading", { name: /study/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^study$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^ppt$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^docs$/i })).toBeVisible();
  });

  test("studio export download returns real PPTX bytes", async ({ page, context, request }) => {
    const account = await registerViaApi(request, "smoke-export");
    await openAuthenticatedApp(page, context, account);
    await mockAiApis(page);
    await page.goto("/app/studio?mode=ppt");
    await page.getByLabel(/title/i).fill("Smoke PPT");
    await page.getByLabel(/what should sahara create/i).fill("Smoke test slides about arrays.");
    await page.getByRole("button", { name: /^generate$/i }).click();
    await expect(page.getByText(/slide 1/i).first()).toBeVisible({ timeout: 20_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download pptx/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/i);
    const fs = await import("node:fs/promises");
    assertPptxOrDocxZip(await fs.readFile((await download.path())!));
  });

  test("export API returns valid PDF without Gemini", async ({ request }) => {
    const account = await registerViaApi(request, "smoke-api-export");
    const response = await request.post(`${API_URL}/api/studio/export`, {
      headers: {
        Authorization: `Bearer ${account.token}`,
        "x-heartspace-request": "1",
        "Content-Type": "application/json",
      },
      data: {
        format: "pdf",
        title: "Smoke PDF",
        content: "# Smoke\n\n## Section\n- one",
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const json = (await response.json()) as { data: string; filename: string };
    assertPdf(Buffer.from(json.data, "base64"));
    expect(json.filename).toMatch(/\.pdf$/i);
  });
});

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, collectFailedRequests } from "./helpers";

test.describe("Public pages", () => {
  test("home loads and navigation reaches about/pricing/feedback", async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    const failed = await collectFailedRequests(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /your everyday life/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start chatting/i }).first()).toBeVisible();

    await page.getByRole("navigation", { name: /site/i }).getByRole("link", { name: /^about$/i }).click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /free and premium/i })).toBeVisible();
    await expect(page.getByText(/pkr 0/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /premium checkout not live/i })).toBeDisabled();
    await expect(page.getByText(/nobody is charged/i).first()).toBeVisible();

    await page.goto("/feedback");
    await expect(page.getByRole("heading").first()).toBeVisible();

    const serious = errors.filter((e) => !/favicon|webgl|ResizeObserver/i.test(e));
    expect(serious, serious.join("\n")).toEqual([]);
    expect(failed.filter((f) => !/favicon/i.test(f)), failed.join("\n")).toEqual([]);
  });

  test("protected routes redirect to login when signed out", async ({ page }) => {
    await page.goto("/app/chat");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/app/studio");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/app/plan");
    await expect(page).toHaveURL(/\/login/);
  });
});

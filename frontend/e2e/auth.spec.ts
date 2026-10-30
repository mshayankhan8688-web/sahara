import { expect, test } from "@playwright/test";
import { loginInBrowser, registerViaApi } from "./helpers";

test.describe("Authentication", () => {
  test("invalid login shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email or phone/i).fill("missing-e2e@example.com");
    await page.getByLabel(/^password$/i).fill("wrong-password");
    await page.getByRole("button", { name: /^login$/i }).click();
    await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("register via API then login/logout in browser", async ({ page, request }) => {
    const account = await registerViaApi(request, "auth");
    await loginInBrowser(page, account.email, account.password);
    await expect(page.getByText(account.user.name).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/free plan/i).first()).toBeVisible();
    await expect(page.getByText(/premium checkout is not live/i).first()).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 15_000 });
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });

  test("hard navigation to register shows create-account form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /get started/i })).toBeVisible();
    await expect(page.getByLabel(/^name$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /start chatting/i })).toBeVisible();
  });
});

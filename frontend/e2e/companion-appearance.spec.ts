import { expect, test } from "@playwright/test";
import { openAuthenticatedApp, registerViaApi, type TestAccount } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Companion page presets", () => {
  let account: TestAccount;

  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, "comp-appear");
  });

  test("companion page offers appearance cards and default chat shows Safa", async ({ page, context }) => {
    await openAuthenticatedApp(page, context, account);
    await page.goto("/app/companion");
    await expect(page.getByRole("heading", { name: /^companion$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /safa/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /rayyan/i })).toBeVisible();

    await page.goto("/app/chat");
    // New accounts default to Safa; Rayyan only appears after an explicit companion selection.
    await expect(page.getByRole("heading", { name: /hey, i'm safa/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/your ai companion/i).first()).toBeVisible();
  });
});

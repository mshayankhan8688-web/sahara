import { expect, test } from "@playwright/test";
import { openAuthenticatedApp, registerViaApi, type TestAccount } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Authenticated app features", () => {
  let account: TestAccount;

  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, "app");
  });

  test.beforeEach(async ({ page, context }) => {
    await openAuthenticatedApp(page, context, account);
  });

  test("chat modes send mocked AI reply and copy works", async ({ page }) => {
    await page.goto("/app/chat");
    await page.getByRole("button", { name: /^study$/i }).click();
    await page.getByLabel(/^message/i).fill("Explain variables in one line for e2e.");
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/sahara e2e chat ok/i).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^copy$/i }).first().click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toMatch(/e2e chat ok/i);
  });

  test("my day task create works without AI", async ({ page }) => {
    await page.goto("/app/plan");
    await expect(page.getByRole("heading", { name: /plan my day/i })).toBeVisible();
    await page.getByLabel(/^task$/i).fill("E2E review notes");
    await page.getByRole("button", { name: /add task/i }).click();
    await expect(page.getByText(/e2e review notes/i)).toBeVisible({ timeout: 15_000 });
  });

  test("career page can request mocked guide", async ({ page }) => {
    await page.goto("/app/career");
    await expect(page.getByRole("heading", { name: /career/i })).toBeVisible();
    await page.getByLabel(/what do you need/i).fill("How do I improve a CV for e2e?");
    await page.getByRole("button", { name: /ask sahara/i }).click();
    await expect(page.getByText(/mocked career guide/i)).toBeVisible({ timeout: 20_000 });
  });

  test("food ideas uses mocked recommend", async ({ page }) => {
    await page.goto("/app/food");
    await expect(page.getByRole("heading", { name: /food ideas/i })).toBeVisible();
    await page.locator("textarea").fill("Something light for dinner");
    await page.getByRole("button", { name: /suggest food/i }).click();
    await expect(page.getByText(/lentil soup|mocked food/i)).toBeVisible({ timeout: 20_000 });
  });

  test("journal and conversations pages load", async ({ page }) => {
    await page.goto("/app/journal");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.goto("/app/conversations");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("embedded plans page keeps checkout disabled", async ({ page }) => {
    await page.goto("/app/pricing");
    await expect(page.getByText(/pkr 0/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /premium checkout not live/i })).toBeDisabled();
  });
});

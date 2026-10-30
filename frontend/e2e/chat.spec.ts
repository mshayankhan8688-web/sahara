import { expect, test } from "@playwright/test";
import { mockAiApis, openAuthenticatedApp, registerViaApi, type TestAccount } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Chat companion experience", () => {
  let account: TestAccount;

  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, "chat-ui");
  });

  test.beforeEach(async ({ page, context }) => {
    await openAuthenticatedApp(page, context, account);
  });

  test("new chat shows welcome and clears prior messages", async ({ page }) => {
    await page.goto("/app/chat");
    await expect(page.getByRole("heading", { name: /hey, i'm/i })).toBeVisible();
    await expect(page.getByText(/what's on your mind today/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^new chat$/i })).toBeVisible();

    await page.getByLabel(/^message/i).fill("hello hello hello hello hello");
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/sahara e2e chat ok/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("link", { name: /^new$/i }).click();
    await expect(page).toHaveURL(/\/app\/chat\/?$/);
    await expect(page.getByRole("heading", { name: /^new chat$/i })).toBeVisible();
    await expect(page.getByText(/sahara e2e chat ok/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /hey, i'm/i })).toBeVisible();
  });

  test("sidebar title truncates visually but keeps accessible full title", async ({ page }) => {
    await page.goto("/app/chat");
    await mockAiApis(page);
    await page.getByLabel(/^message/i).fill(
      "I am feeling lonely and thinking too much and I don't know what to do with everything today",
    );
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/sahara e2e chat ok/i).first()).toBeVisible({ timeout: 20_000 });

    const heading = page.locator("h1.chat-title");
    await expect(heading).toBeVisible();
    const titleText = (await heading.innerText()).trim();
    expect(titleText.length).toBeLessThanOrEqual(48);
    expect(titleText.toLowerCase()).not.toContain("don't know what to do");

    const sidebarLink = page.locator('a[href^="/app/chat/"]').filter({ hasText: titleText.split(" ")[0]! }).first();
    if (await sidebarLink.count()) {
      const accessible = (await sidebarLink.getAttribute("aria-label")) || (await sidebarLink.getAttribute("title")) || "";
      expect(accessible.length).toBeGreaterThan(0);
    }
  });

  test("Safa header stays stable and listen mode can send mocked reply", async ({ page }) => {
    await page.goto("/app/chat");
    await expect(page.getByText(/^safa$/i).first()).toBeVisible();
    await expect(page.getByText(/your ai companion/i).first()).toBeVisible();
    await page.getByRole("button", { name: /^listen$/i }).click();
    await page.getByLabel(/^message/i).fill("Yaar aaj bohat lonely feel ho raha hai.");
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/sahara e2e chat ok/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/mocked reply/i).first()).toBeVisible();
  });

  test("old conversation route still loads history after new chat", async ({ page }) => {
    const convId = "507f1f77bcf86cd799439011";
    const userMsg = "Preserve this history message for e2e.";

    await page.route("**/api/chat/message", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversation: { id: convId, title: "Preserve history", updatedAt: new Date().toISOString() },
          userMessage: {
            id: "hist-user",
            sender: "user",
            kind: "ai",
            content: userMsg,
            createdAt: new Date().toISOString(),
          },
          assistantMessage: {
            id: "hist-asst",
            sender: "assistant",
            kind: "ai",
            content: "**Mocked reply**\n\nSAHARA e2e chat ok.",
            createdAt: new Date().toISOString(),
          },
          usage: {
            planId: "free",
            planName: "Free",
            day: "2026-10-30",
            resetsAt: "2026-10-31T00:00:00.000Z",
            paymentsConfigured: false,
            buckets: [],
          },
        }),
      });
    });

    await page.route(`**/api/conversations/${convId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversation: { id: convId, title: "Preserve history", updatedAt: new Date().toISOString() },
          messages: [
            {
              id: "hist-user",
              sender: "user",
              kind: "ai",
              content: userMsg,
              createdAt: new Date().toISOString(),
            },
            {
              id: "hist-asst",
              sender: "assistant",
              kind: "ai",
              content: "**Mocked reply**\n\nSAHARA e2e chat ok.",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto("/app/chat");
    await page.getByLabel(/^message/i).fill(userMsg);
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/preserve this history message/i)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`/app/chat/${convId}`));

    await page.goto("/app/chat");
    await expect(page.getByText(/preserve this history message/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /hey, i'm/i })).toBeVisible();

    await page.goto(`/app/chat/${convId}`);
    await expect(page.getByText(/preserve this history message/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/sahara e2e chat ok/i).first()).toBeVisible();
  });
});

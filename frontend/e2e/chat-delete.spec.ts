import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { API_URL, openAuthenticatedApp, registerViaApi, type TestAccount } from "./helpers";

test.describe.configure({ mode: "serial" });

const backendDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../backend");

function seedConversations(userId: string): { conversationId: string; otherId: string } {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/seed-chat-delete-e2e.mjs", userId],
    { cwd: backendDir, encoding: "utf8" },
  );
  const line = output.trim().split(/\r?\n/).at(-1) ?? "";
  return JSON.parse(line) as { conversationId: string; otherId: string };
}

async function deleteViaSidebarMenu(page: import("@playwright/test").Page, conversationId: string) {
  const row = page.locator(`a[href="/app/chat/${conversationId}"]`).first();
  await expect(row).toBeVisible();
  const group = row.locator("xpath=ancestor::div[contains(@class,'group')]");
  await group.getByRole("button", { name: /chat options/i }).click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/permanently removed/i)).toBeVisible();
  await page.getByRole("button", { name: /delete forever/i }).click();
}

test.describe("Chat delete", () => {
  let account: TestAccount;
  let conversationId = "";
  let otherId = "";

  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, "chat-del");
    ({ conversationId, otherId } = seedConversations(account.user.id));
  });

  test("deletes active chat from sidebar menu and keeps siblings after reload", async ({ page, context, request }) => {
    await openAuthenticatedApp(page, context, account);
    await page.goto(`/app/chat/${conversationId}`);
    await expect(page.getByText("Active chat body for delete e2e", { exact: true })).toBeVisible({ timeout: 20_000 });

    await deleteViaSidebarMenu(page, conversationId);

    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/app\/chat\/?$/);
    await expect(page.locator(`a[href="/app/chat/${conversationId}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href="/app/chat/${otherId}"]`)).toHaveCount(1);

    await page.reload();
    await page.goto("/app/chat");
    await expect(page.locator(`a[href="/app/chat/${conversationId}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href="/app/chat/${otherId}"]`)).toBeVisible();

    const list = await request.get(`${API_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${account.token}` },
    });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as { conversations: { id: string }[] };
    expect(body.conversations.some((item) => item.id === conversationId)).toBeFalsy();
    expect(body.conversations.some((item) => item.id === otherId)).toBeTruthy();
  });

  test("deletes a conversation from search results without restoring it", async ({ page, context, request }) => {
    const searchAccount = await registerViaApi(request, "chat-del-search");
    const seeded = seedConversations(searchAccount.user.id);

    await openAuthenticatedApp(page, context, searchAccount);
    await page.goto(`/app/chat/${seeded.conversationId}`);
    await expect(page.getByText("Active chat body for delete e2e", { exact: true })).toBeVisible({ timeout: 20_000 });

    const search = page.getByRole("textbox", { name: /search chats/i });
    await search.fill("Delete Active");
    await expect(page.locator(`a[href="/app/chat/${seeded.conversationId}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/app/chat/${seeded.otherId}"]`)).toHaveCount(0);

    await deleteViaSidebarMenu(page, seeded.conversationId);
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`a[href="/app/chat/${seeded.conversationId}"]`)).toHaveCount(0);

    await search.fill("");
    await expect(page.locator(`a[href="/app/chat/${seeded.conversationId}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href="/app/chat/${seeded.otherId}"]`)).toBeVisible();

    await page.reload();
    await page.goto("/app/chat");
    await expect(page.locator(`a[href="/app/chat/${seeded.conversationId}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href="/app/chat/${seeded.otherId}"]`)).toBeVisible();
  });
});

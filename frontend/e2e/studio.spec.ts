import { expect, test } from "@playwright/test";
import {
  API_URL,
  assertPdf,
  assertPptxOrDocxZip,
  openAuthenticatedApp,
  registerViaApi,
  type TestAccount,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Studio and downloads", () => {
  let account: TestAccount;

  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, "studio");
  });

  test.beforeEach(async ({ page, context }) => {
    await openAuthenticatedApp(page, context, account);
  });

  test("assignment empty topic keeps generate disabled", async ({ page }) => {
    await page.goto("/app/studio?mode=assignment");
    await expect(page.getByRole("heading", { name: /assignment maker/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^generate$/i })).toBeDisabled();
  });

  test("assignment generate (mocked) shows loading then result", async ({ page }) => {
    await page.goto("/app/studio?mode=assignment");
    await page.getByLabel(/topic \/ title/i).fill("E2E Photosynthesis Assignment");
    await page.getByLabel(/additional instructions/i).fill("Keep it short for e2e.");
    await page.getByRole("button", { name: /^generate$/i }).click();
    await expect(page.getByRole("button", { name: /generating with gemini/i })).toBeVisible();
    await expect(page.getByText(/mocked assignment|introduction/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("study generate (mocked AI) then copy", async ({ page }) => {
    await page.goto("/app/studio?mode=study");
    await page.getByLabel(/what should sahara create/i).fill("Explain recursion briefly for e2e.");
    await page.getByRole("button", { name: /^generate$/i }).click();
    await expect(page.getByText(/mocked study content|introduction/i).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^copy$/i }).click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toMatch(/mocked study/i);
  });

  for (const mode of ["exam", "writing", "document"] as const) {
    test(`${mode} studio generate is mocked`, async ({ page }) => {
      await page.goto(`/app/studio?mode=${mode}`);
      await page.getByLabel(/what should sahara create/i).fill(`E2E prompt for ${mode}`);
      await page.getByRole("button", { name: /^generate$/i }).click();
      await expect(page.getByText(new RegExp(`mocked ${mode}|introduction`, "i")).first()).toBeVisible({
        timeout: 20_000,
      });
    });
  }

  test("Listen mode redirects from Studio to Chat", async ({ page }) => {
    await page.goto("/app/studio?mode=emotion");
    await expect(page).toHaveURL(/\/app\/chat\?mode=emotion/);
  });

  test("PPT generate (mocked) then real PPTX download", async ({ page }) => {
    await page.goto("/app/studio?mode=ppt");
    await page.getByLabel(/title/i).fill("E2E PPT");
    await page.getByLabel(/what should sahara create/i).fill("Make slides about databases for e2e.");
    await page.getByRole("button", { name: /^generate$/i }).click();
    await expect(page.getByText(/slide 1/i).first()).toBeVisible({ timeout: 20_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download pptx/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import("node:fs/promises");
    assertPptxOrDocxZip(await fs.readFile(path!));
  });

  test("document generate then real DOCX and PDF downloads", async ({ page }) => {
    await page.goto("/app/studio?mode=document");
    await page.getByLabel(/what should sahara create/i).fill("Write short notes on indexing for e2e.");
    await page.getByRole("button", { name: /^generate$/i }).click();
    await expect(page.getByText(/introduction/i).first()).toBeVisible({ timeout: 20_000 });

    const fs = await import("node:fs/promises");
    const docxDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /download docx/i }).click();
    const docx = await docxDownload;
    expect(docx.suggestedFilename()).toMatch(/\.docx$/i);
    assertPptxOrDocxZip(await fs.readFile((await docx.path())!));

    const pdfDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /download pdf/i }).click();
    const pdf = await pdfDownload;
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/i);
    assertPdf(await fs.readFile((await pdf.path())!));
  });

  test("image studio uses mocked image endpoint", async ({ page }) => {
    await page.goto("/app/studio?mode=image");
    await page.getByLabel(/what should sahara create/i).fill("A simple study diagram of a water cycle");
    await page.getByRole("button", { name: /^generate$/i }).click();
    await expect(page.getByRole("img", { name: /mock\.png/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /download image/i })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download image/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/i);
    const fs = await import("node:fs/promises");
    const bytes = await fs.readFile((await download.path())!);
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});

test.describe("Export API file integrity", () => {
  test("authenticated export returns valid office/pdf bytes", async ({ request }) => {
    const account = await registerViaApi(request, "export");
    const headers = {
      Authorization: `Bearer ${account.token}`,
      "x-heartspace-request": "1",
      "Content-Type": "application/json",
    };
    const presentation = {
      title: "API Export",
      slides: [
        { title: "One", bullets: ["A", "B"] },
        { title: "Two", bullets: ["C"] },
      ],
    };
    for (const format of ["pptx", "docx", "pdf"] as const) {
      const response = await request.post(`${API_URL}/api/studio/export`, {
        headers,
        data: {
          format,
          title: `E2E ${format}`,
          content: "# E2E\n\n## Section\n- one\n- two",
          presentation,
        },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      const json = (await response.json()) as { data: string; filename: string };
      const buffer = Buffer.from(json.data, "base64");
      if (format === "pdf") assertPdf(buffer);
      else assertPptxOrDocxZip(buffer);
      expect(json.filename).toMatch(new RegExp(`\\.${format}$`, "i"));
    }
  });
});

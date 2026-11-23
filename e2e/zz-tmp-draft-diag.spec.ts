import { test, expect } from "@playwright/test";

import { formFor, issueDetailsEditor } from "./form-helpers";

// TEMPORARY diagnostic — delete after use.
test.use({ storageState: "e2e/.auth/student.json" });

const dump = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.includes("issue-draft"));
    return key ? localStorage.getItem(key) : null;
  });

test("diag draft restore", async ({ page }) => {
  await page.goto("/dashboard/issues/new");
  const form = formFor(page, "Create issue");
  await form.locator('input[name="title"]').fill("Draft survives reload");
  await issueDetailsEditor(form).click();
  await page.keyboard.type("Module 5 text");
  await expect.poll(async () => ((await dump(page)) ?? "").includes("Module 5")).toBe(true);
  const before = await dump(page);

  await page.reload();
  const restored = formFor(page, "Create issue");
  await expect(restored.locator('input[name="title"]')).toHaveValue("Draft survives reload");
  await page.waitForTimeout(1500);
  const after = await dump(page);
  const editorText = (await issueDetailsEditor(restored).innerText()).replace(/\s+/g, " ").trim();
  const hidden = await restored.locator('input[type="hidden"][name="question"]').inputValue();
  console.log("DIAG " + JSON.stringify({ before, after, editorText, hidden }));
});

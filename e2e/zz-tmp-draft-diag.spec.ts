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

  // From here on, log every draft write and every time the editor text changes.
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __log: string[] }).__log = log;
    const t0 = performance.now();
    const stamp = () => Math.round(performance.now() - t0);
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.includes("issue-draft")) {
        log.push(`${stamp()}ms setItem question=${JSON.stringify(JSON.parse(value).question)}`);
      }
      return set.call(this, key, value);
    };
    const rm = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (key.includes("issue-draft")) log.push(`${stamp()}ms removeItem`);
      return rm.call(this, key);
    };
    let last = "";
    new MutationObserver(() => {
      const el = document.querySelector('[role="textbox"][aria-label="Issue details"], [aria-label="Issue details"]');
      const text = el ? (el.textContent ?? "").replace(/\s+/g, " ").trim() : "(no editor)";
      if (text !== last) {
        last = text;
        log.push(`${stamp()}ms editorText=${JSON.stringify(text)}`);
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });

  await page.reload();
  const restored = formFor(page, "Create issue");
  await expect(restored.locator('input[name="title"]')).toHaveValue("Draft survives reload");
  await page.waitForTimeout(1500);
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  const editorText = (await issueDetailsEditor(restored).innerText()).replace(/\s+/g, " ").trim();
  console.log("DIAG final=" + JSON.stringify(editorText) + " log=" + JSON.stringify(log));
});

import { test, expect } from "@playwright/test";

import {
  chooseStudentCourse,
  fillIssueDetails,
  formFor,
  issueDetailsEditor,
  submitAndWait,
} from "./form-helpers";

/**
 * The student details field is a Tiptap editor that submits Markdown through
 * a hidden `question` input. These run in a real browser because jsdom has no
 * selection, IME or clipboard behaviour worth trusting.
 */
test.describe("Issue details editor (student)", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  const question = (form: ReturnType<typeof formFor>) =>
    form.locator('input[type="hidden"][name="question"]');

  test("formats with shortcuts and Markdown typing, and the issue page renders it", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    const title = `E2E editor formatting ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    const editor = issueDetailsEditor(form);
    await expect(editor).toBeVisible();
    await expect(form.locator("textarea[name='question']")).toHaveCount(0);

    await editor.click();
    await page.keyboard.type("After login the dashboard stays blank. I run ");
    // Inline code from typing backticks, bold from the keyboard shortcut.
    await page.keyboard.type("`npm run dev` ");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type("every time");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.press("Enter");
    // "- " at the start of a line starts a bullet list.
    await page.keyboard.type("- cleared the cache");
    await page.keyboard.press("Enter");
    await page.keyboard.type("reinstalled node_modules");

    await expect(question(form)).toHaveValue(
      "After login the dashboard stays blank. I run `npm run dev` **every time**\n\n- cleared the cache\n- reinstalled node\\_modules",
    );

    await form.locator('input[name="title"]').fill(title);
    await chooseStudentCourse(form);
    await submitAndWait(page, "Create issue", /\/dashboard\/issues\/[a-f0-9]{24}\?created=1$/);

    const body = page.locator("main");
    await expect(body.locator("strong", { hasText: "every time" })).toBeVisible();
    await expect(body.locator("code", { hasText: "npm run dev" })).toBeVisible();
    await expect(body.locator("li", { hasText: "reinstalled node_modules" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("keeps only safe structure from pasted HTML and never runs it", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    const editor = issueDetailsEditor(form);
    await editor.click();

    await editor.evaluate((element) => {
      const data = new DataTransfer();
      data.setData(
        "text/html",
        '<p><span style="color:red;font-size:30px">Styled <b>bold</b></span><img src="x" onerror="window.__pwned = true"></p><ul><li>item</li></ul><script>window.__pwned = true</script>',
      );
      data.setData("text/plain", "Styled bold\nitem");
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });

    await expect(question(form)).toHaveValue("Styled **bold**\n\n- item");
    await expect(editor.locator("[style], img, script")).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { __pwned?: boolean }).__pwned)).toBeUndefined();
  });

  test("pastes a stack trace as a code block, with an Undo chip", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    const editor = issueDetailsEditor(form);
    await editor.click();
    await page.keyboard.type("My error:");
    await page.keyboard.press("Enter");

    const trace = "TypeError: Cannot read properties of undefined (reading 'map')\n    at App (App.jsx:12:5)";
    await editor.evaluate((element, text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, trace);

    await expect(question(form)).toHaveValue(`My error:\n\n\`\`\`\n${trace}\n\`\`\``);
    const undo = form.getByRole("button", { name: /Undo code formatting/ });
    await expect(undo).toBeVisible();
    const undoBox = await undo.boundingBox();
    expect(undoBox?.height).toBeGreaterThanOrEqual(44);

    await undo.click();
    await expect(undo).toHaveCount(0);
    await expect(question(form)).toHaveValue(
      "My error:\n\nTypeError: Cannot read properties of undefined (reading 'map')\n\nat App (App.jsx:12:5)",
    );
  });

  test("works at 375px with Bangla text and no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    const editor = issueDetailsEditor(form);

    await editor.click();
    // insertText is what an IME (Avro, Gboard) commits.
    await page.keyboard.insertText("আমার React app-এ লগইন করার পর পেজটা সাদা হয়ে যায়।");
    await expect(question(form)).toHaveValue("আমার React app-এ লগইন করার পর পেজটা সাদা হয়ে যায়।");

    const box = await editor.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });

  test("toolbar formats by mouse and keyboard and fits a 375px phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    const editor = issueDetailsEditor(form);
    const toolbar = form.getByRole("toolbar", { name: "Formatting" });
    await expect(toolbar).toBeVisible();

    // Every button is a 44px touch target and the page never scrolls sideways.
    for (const button of await toolbar.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    await editor.click();
    await page.keyboard.type("Steps");
    await toolbar.getByRole("button", { name: "Heading" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await toolbar.getByRole("button", { name: "Numbered list" }).click();
    await page.keyboard.type("open the page");
    await page.keyboard.press("Enter");
    await page.keyboard.type("see the error");
    await expect(question(form)).toHaveValue("## Steps\n\n1. open the page\n2. see the error");

    // Keyboard: one Tab stop into the toolbar, arrows move inside it.
    await toolbar.getByRole("button", { name: "Undo" }).focus();
    await page.keyboard.press("Home");
    await expect(toolbar.getByRole("button", { name: "Bold" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(toolbar.getByRole("button", { name: "Redo" })).toBeFocused();
    // Nothing to redo: the button stays reachable but reports itself unavailable.
    await expect(toolbar.getByRole("button", { name: "Redo" })).toHaveAttribute("aria-disabled", "true");

    // Link from the shortcut, on the selected word.
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Shift+ControlOrMeta+ArrowLeft");
    await page.keyboard.press("ControlOrMeta+k");
    const address = form.getByLabel("Link address");
    await expect(address).toBeFocused();
    await address.fill("javascript:alert(1)");
    await address.press("Enter");
    await expect(form.getByText("Use a web address")).toBeVisible();
    await address.fill("developer.mozilla.org/en-US/docs/Web");
    await address.press("Enter");
    await expect(question(form)).toHaveValue(
      "## Steps\n\n1. open the page\n2. see the [error](https://developer.mozilla.org/en-US/docs/Web)",
    );
  });

  test("restores the typed text after a server-side rejection is fixed", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    await form.locator('input[name="title"]').fill("Editor value survives");
    await fillIssueDetails(form, "Too short");

    await form.getByRole("button", { name: "Create issue", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Add at least 40 characters");

    await issueDetailsEditor(form).press("End");
    await page.keyboard.type(" because the assignment page never finishes loading.");
    await expect(form.getByRole("alert")).toHaveCount(0);
    await expect(question(form)).toHaveValue("Too short because the assignment page never finishes loading.");
  });
});

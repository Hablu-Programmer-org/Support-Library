import { test, expect } from "@playwright/test";

import {
  chooseStudentCourse,
  fillIssueDetails,
  formFor,
  issueDetailsEditor,
  submitAndWait,
} from "./form-helpers";
import { TINY_PNG } from "./image-fixture";

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

  test("pasted and dropped screenshots go to Screenshots and are uploaded with the issue", async ({ page }) => {
    const title = `E2E editor screenshot ${Date.now()}`;
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    const editor = issueDetailsEditor(form);
    await editor.click();

    const pngBase64 = TINY_PNG.toString("base64");
    // Clipboard screenshot: an image and no text.
    await editor.evaluate((element, data) => {
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], "pasted.png", { type: "image/png", lastModified: 1 }));
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
    }, pngBase64);
    await expect(form.getByRole("status").filter({ hasText: "1 screenshot added to Screenshots below." })).toBeVisible();
    await expect(form.locator('img[alt="Preview of pasted.png"]')).toBeVisible();
    await expect(editor.locator("img")).toHaveCount(0);

    // Dragged from the desktop onto the text.
    await editor.evaluate((element, data) => {
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], "dropped.png", { type: "image/png", lastModified: 2 }));
      const box = element.getBoundingClientRect();
      element.dispatchEvent(
        new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true, clientX: box.left + 10, clientY: box.top + 10 }),
      );
    }, pngBase64);
    await expect(form.locator('img[alt="Preview of dropped.png"]')).toBeVisible();
    // Added once, not also by the page-wide drop listener.
    await expect(form.locator('img[alt^="Preview of "]')).toHaveCount(2);

    // Both ride in the real file input, so the existing upload path sends them
    // (attachments.spec.ts covers what staff then see).
    expect(
      await form.locator('input[type="file"][name="uploads"]').evaluate((input) =>
        Array.from((input as HTMLInputElement).files ?? []).map((file) => file.name),
      ),
    ).toEqual(["pasted.png", "dropped.png"]);

    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("The submit button on the assignment page does nothing, see the screenshots.");
    await form.locator('input[name="title"]').fill(title);
    await chooseStudentCourse(form);
    await submitAndWait(page, "Create issue", /\/dashboard\/issues\/[a-f0-9]{24}\?created=1$/);
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

  test("Use template: blocks a template-only submit, then submits only filled sections", async ({ page }) => {
    const title = `E2E template ${Date.now()}`;
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    const editor = issueDetailsEditor(form);
    await expect(editor).toBeVisible();
    await form.locator('input[name="title"]').fill(title);

    const useTemplate = form.getByRole("button", { name: /Use template/ });
    await useTemplate.click();
    await expect(editor.locator("h2")).toHaveText(["কী করতে চাচ্ছিলাম", "কী হলো", "কী try করেছি"]);
    await expect(useTemplate).toBeDisabled();

    // Headings alone are not the student's words.
    await form.getByRole("button", { name: "Create issue", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("নিজের ভাষায় সমস্যাটা লিখুন");
    await expect(page).toHaveURL("/dashboard/issues/new");

    // The caret is under the first heading; fill only that section.
    await editor.locator("p").first().click();
    await page.keyboard.type("Module 5-এর assignment submit করলে link থেকে 404 আসছে।");
    await expect(form.getByRole("alert")).toHaveCount(0);
    await expect(question(form)).toHaveValue(
      "## কী করতে চাচ্ছিলাম\n\nModule 5-এর assignment submit করলে link থেকে 404 আসছে।",
    );

    await chooseStudentCourse(form);
    await submitAndWait(page, "Create issue", /\/dashboard\/issues\/[a-f0-9]{24}\?created=1$/);
    const body = page.locator("main");
    await expect(body.getByRole("heading", { name: "কী করতে চাচ্ছিলাম" })).toBeVisible();
    await expect(body.getByRole("heading", { name: "কী হলো" })).toHaveCount(0);
  });

  test("keeps an unsent draft across a reload until it is discarded", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    await form.locator('input[name="title"]').fill("Draft survives reload");
    await issueDetailsEditor(form).click();
    await page.keyboard.type("Module 5-এর video load হচ্ছে না।");
    // Autosave runs shortly after typing stops.
    await expect
      .poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("issue-draft")).length))
      .toBe(1);

    await page.reload();
    const restored = formFor(page, "Create issue");
    await expect(restored.locator('input[name="title"]')).toHaveValue("Draft survives reload");
    await expect(question(restored)).toHaveValue("Module 5-এর video load হচ্ছে না।");
    await expect(restored.getByRole("status").filter({ hasText: "Restored your unsent draft" })).toBeVisible();

    await restored.getByRole("button", { name: "Discard draft" }).click();
    await expect(restored.locator('input[name="title"]')).toHaveValue("");
    await expect(question(restored)).toHaveValue("");
    await page.reload();
    await expect(issueDetailsEditor(formFor(page, "Create issue"))).toBeVisible();
    await expect(formFor(page, "Create issue").locator('input[name="title"]')).toHaveValue("");
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

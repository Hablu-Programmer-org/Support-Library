import { test, expect, type Page } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

test.use({ storageState: "e2e/.auth/mentor.json" });

const ISSUE_URL = /\/dashboard\/issues\/[a-f0-9]{24}$/;

const submitCreate = (page: Page) => submitAndWait(page, "Create Issue", ISSUE_URL);

test.describe("Issue CRUD (mentor)", () => {
  for (const scenario of [
    { label: "text and attachments", body: "Use the documented fix for the image path.", solved: true },
    { label: "attachments only", body: "", solved: true },
    { label: "answer awaiting confirmation", body: "Please try the attached fix and confirm.", solved: false },
  ]) {
    test(`creates an issue with ${scenario.label} in one submission`, async ({ page }) => {
      await page.goto("/dashboard/issues/new");
      const form = formFor(page, "Create Issue");
      await form.locator('input[name="studentName"]').fill("E2E Answer Student");
      await form.locator('input[name="studentEmail"]').fill(`e2e.answer.${Date.now()}@test.com`);
      await form.locator('input[name="title"]').fill(`E2E ${scenario.label}`);
      await form.locator('textarea[name="question"]').fill("How do I fix the broken image path?");
      await form.locator('textarea[name="solutionBody"]').fill(scenario.body);
      await form
        .locator('textarea[name="solutionFileLinks"]')
        .fill("Guide|https://example.com/fix.pdf|pdf\nScreenshot|https://example.com/fix.png|image");
      await form
        .locator('textarea[name="solutionVideoLinks"]')
        .fill("Walkthrough|https://example.com/fix.mp4|01:20");
      await expect(form.locator('input[name="solveIssue"]')).toBeChecked();
      if (!scenario.solved) await form.locator('input[name="solveIssue"]').uncheck();
      await submitCreate(page);
      const reply = page.locator('[data-testid^="reply-"]');
      await expect(reply).toHaveCount(1);
      if (scenario.body) await expect(reply).toContainText(scenario.body);
      await expect(reply.locator('a[href="https://example.com/fix.pdf"]')).toBeVisible();
      await expect(reply.locator('a[href="https://example.com/fix.png"]')).toBeVisible();
      await expect(reply.locator('a[href="https://example.com/fix.mp4"]')).toBeVisible();
      await expect(page.locator("span").filter({ hasText: scenario.solved ? /^Solved$/ : /^Open$/ }).first()).toBeVisible();
    });
  }

  test("creates an issue, replies, and updates status", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Test Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.student.${Date.now().toString()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E React image not rendering");
    await form.locator('textarea[name="question"]').fill("Image show hocche na in React component");
    await expect(form.locator('select[name="status"]')).toHaveCount(0);
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitCreate(page);
    await expect(page.getByText("E2E React image not rendering")).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Open$/ }).first()).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Image show hocche na in React component" }).first()).toBeVisible();

    const replyForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Add response" }) })
      .first();
    await replyForm.locator('textarea[name="body"]').fill("Use public folder with /image.png");
    await replyForm.getByRole("button", { name: "Add response" }).click();
    await expect(page.locator("article").filter({ hasText: "Use public folder with /image.png" })).toBeVisible();

    const statusForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Update status", exact: true }) }).first();
    await statusForm.locator('select[name="status"]').selectOption("SOLVED");
    await statusForm.getByRole("button", { name: "Update status", exact: true }).click();
    await expect(page.locator("span").filter({ hasText: /^Solved$/ }).first()).toBeVisible();

    // Edit controls are author-scoped: this mentor owns the reply added above.
    const reply = page.locator("article").filter({ hasText: "Use public folder with /image.png" });
    await reply.getByRole("button", { name: "Edit", exact: true }).click();

    // While editing, the body paragraph is replaced by the editor, so anchor the
    // editor on the reply article itself rather than on the old body text.
    const editor = reply;
    await editor.locator('textarea[name="body"]').fill("Edited: use /public/image.png");
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(
      page.locator("article").filter({ hasText: "Edited: use /public/image.png" }),
    ).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Use public folder with /image.png" })).toHaveCount(0);
    await expect(page.locator("article").filter({ hasText: "edited" }).first()).toBeVisible();
  });

  test("autofills student name from an LMS email match", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");

    await form.locator('input[name="studentEmail"]').fill("e2e.lms.student@test.com");
    const studentName = form.getByLabel("Student Name *").first();
    await expect(studentName).toHaveValue("E2E LMS Student");
    await expect(page.getByText("Found in LMS")).toBeVisible();
    await expect(studentName).toBeVisible();
    await expect(studentName).toBeDisabled();
    await expect
      .poll(() =>
        form.evaluate((el) =>
          new FormData(el as HTMLFormElement).get("studentName"),
        ),
      )
      .toBe("E2E LMS Student");

    await form.locator('input[name="title"]').fill("E2E LMS autofill submission");
    await form.locator('textarea[name="question"]').fill("Does the disabled LMS name submit correctly?");
    await submitCreate(page);
    await expect(page.getByText("E2E LMS autofill submission")).toBeVisible();
  });

  test("rejects a submitted LMS id that does not belong to the email", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentEmail"]').fill("e2e.lms.student@test.com");
    await expect(page.getByText("Found in LMS")).toBeVisible();
    await form.locator('input[name="title"]').fill("E2E mismatched LMS identity");
    await form.locator('textarea[name="question"]').fill("The server must reject a mismatched LMS identity.");
    // The visible fields above are React-controlled, so any re-render would reset a
    // plain DOM value assignment. Tamper with the hidden input and submit in the same
    // synchronous task so the submitted FormData carries the tampered value.
    await form.getByRole("button", { name: "Create Issue", exact: true }).evaluate((btn) => {
      const form = (btn as HTMLButtonElement).form!;
      (form.querySelector('input[name="lmsUserId"]') as HTMLInputElement).value = "another-lms-user";
      form.requestSubmit();
    });
    await expect(page.getByRole("alert").filter({ hasText: "does not match this email" })).toBeVisible();
    await expect(page).toHaveURL("/dashboard/issues/new");
  });

  test("rejects a stale issue edit", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Stale Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.stale.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E stale issue update");
    await form.locator('textarea[name="question"]').fill("A stale revision must not overwrite newer data.");
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitCreate(page);
    await page.getByRole("link", { name: "Edit issue details" }).click();
    const editForm = formFor(page, "Save Issue");
    await editForm.locator('input[name="title"]').fill("E2E stale overwrite attempt");
    // React re-asserts controlled `value` props on every re-render, so a plain DOM
    // assignment is reverted. Tamper with the hidden revision input and submit in the
    // same synchronous task so the submitted FormData carries the stale revision.
    await editForm.getByRole("button", { name: "Save Issue" }).evaluate((btn) => {
      const form = (btn as HTMLButtonElement).form!;
      (form.querySelector('input[name="expectedUpdatedAt"]') as HTMLInputElement).value = "2000-01-01T00:00:00.000Z";
      form.requestSubmit();
    });
    await expect(page.getByRole("alert").filter({ hasText: "Issue changed since you opened it" })).toBeVisible();
  });

  test("allows a manual student name after an LMS lookup miss", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");

    await form.locator('input[name="studentEmail"]').fill("e2e.lms.student@test.com");
    await expect(page.getByText("Found in LMS")).toBeVisible();
    await form.locator('input[name="studentEmail"]').fill("some.other.member@test.com");
    await expect(page.getByText("No matching LMS user found.", { exact: false })).toBeVisible();
    await form.locator('input[name="studentName"]').fill("Manual Name");
    await form.locator('input[name="studentEmail"]').fill("e2e.lms.student@test.com");
    await expect(page.getByText("Found in LMS")).toBeVisible();
    await expect(form.locator('input[name="studentName"]').first()).toHaveValue("Manual Name");
  });

  test("renders the issue article without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Mobile Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.mobile.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E mobile issue article");
    await form.locator('textarea[name="question"]').fill(
      "A long support question should remain readable without creating horizontal scrolling on a phone.",
    );
    await form.locator('input[name="solveIssue"]').uncheck();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const navigated = page
        .waitForURL(ISSUE_URL, { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      await form.getByRole("button", { name: "Create Issue", exact: true }).click();
      if (await navigated) break;
    }

    await expect(page.getByRole("heading", { name: "E2E mobile issue article" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The problem" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Responses" })).toBeVisible();
    const archiveHeading = page.getByRole("heading", { name: "Archive this issue" });
    const dangerZone = page.locator("section").filter({ has: archiveHeading });
    await expect(dangerZone).toHaveClass(/dark:bg-slate-900/);
    await expect(archiveHeading).toHaveClass(/dark:text-slate-50/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("edits an issue and persists the change", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Edit Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.edit.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E editable issue");
    await form.locator('textarea[name="question"]').fill("This issue is going to be edited successfully.");
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitCreate(page);

    await page.getByRole("link", { name: "Edit issue details" }).click();
    await expect(page.getByRole("heading", { name: "Edit issue" })).toBeVisible();
    const editForm = formFor(page, "Save Issue");
    await editForm.locator('input[name="title"]').fill("E2E edited issue title");
    await submitAndWait(page, "Save Issue", ISSUE_URL);
    await expect(page.getByRole("heading", { name: "E2E edited issue title" })).toBeVisible();
  });

  test("rejects moving an issue to ARCHIVED through the edit form", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Guard Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.guard.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E archive guard issue");
    await form.locator('textarea[name="question"]').fill("Editing must not be able to archive this issue.");
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitCreate(page);

    await page.getByRole("link", { name: "Edit issue details" }).click();
    await expect(page.getByRole("heading", { name: "Edit issue" })).toBeVisible();
    // The rendered status control never offers ARCHIVED. Inject it and submit in one
    // synchronous task so the server sees a tampered value and must reject it.
    const editForm = formFor(page, "Save Issue");
    await editForm.getByRole("button", { name: "Save Issue" }).evaluate((btn) => {
      const form = (btn as HTMLButtonElement).form!;
      const select = form.querySelector('select[name="status"]') as HTMLSelectElement;
      const option = document.createElement("option");
      option.value = "ARCHIVED";
      select.appendChild(option);
      select.value = "ARCHIVED";
      form.requestSubmit();
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "Use the Archive issue action instead" }),
    ).toBeVisible();
  });

  test("archives an issue from the detail page", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Archive Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.archive.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E issue to archive");
    await form.locator('textarea[name="question"]').fill("This issue is going to be archived.");
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitCreate(page);

    // The archive control gates submission behind window.confirm; accept it so the
    // form action actually runs, then confirm the redirect back to the issue list.
    page.on("dialog", (dialog) => dialog.accept());
    await submitAndWait(page, "Archive issue", /\/dashboard\/issues$/);
    await expect(page).toHaveURL("/dashboard/issues");
  });
});

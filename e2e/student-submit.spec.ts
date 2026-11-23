import { test, expect } from "@playwright/test";

import { resetStudentCreateBudget } from "./fixtures/student-create-budget";

import { chooseStudentCourse, fillIssueDetails, fillMarkdownEditor, formFor, issueDetailsEditor, markdownValue, submitAndWait } from "./form-helpers";

/**
 * Student self-service: a STUDENT may submit an issue and nothing else.
 *
 * The case is prepared by the student and then asserted from the staff side, so
 * this proves both the create path and that the request lands as an internal
 * case owned by the submitting account.
 */
test.describe("STUDENT issue submission", () => {
  test.use({ storageState: "e2e/.auth/student.json" });
  test.beforeEach(resetStudentCreateBudget);

  test("submits a request that staff can pick up", async ({ page, browser }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const baseURL = test.info().project.use.baseURL as string;
    const title = `E2E student request ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    await expect(page.getByRole("heading", { name: "Create an issue" })).toBeVisible();

    const form = formFor(page, "Create issue");
    // The student picks no identity — it is derived from the session.
    await expect(form.locator('input[name="studentEmail"]')).toHaveCount(0);
    await expect(form.locator('textarea[name="fileLinks"]')).toHaveCount(0);
    await expect(form.getByLabel(/Issue title/)).toBeVisible();
    await expect(form.getByLabel(/Problem title/)).toHaveCount(0);
    await form.locator('input[name="title"]').fill(title);
    await fillIssueDetails(form, "The lecture video keeps buffering on the third module.");
    // Required course context is never hidden in the optional disclosure.
    const courseSelect = form.locator('select[name="courseSlug"]');
    await expect(courseSelect).toBeVisible();
    await courseSelect.selectOption("jfwd");
    await expect(form.locator('input[aria-label="Batch (filled from your enrolment)"]')).toHaveValue("2");

    const optional = form
      .locator("details")
      .filter({ hasText: "Module, lesson, tags or video links" });
    await optional.locator("summary").click();
    // Uploaded image attachments are covered in attachments.spec.ts; videos remain
    // external HTTPS links inside the optional context disclosure.
    await optional
      .locator('textarea[name="videoLinks"]')
      .fill("Walkthrough|https://youtu.be/demo123|01:30|Shows the buffering");
    await optional.locator('input[name="tags"]').fill("buffering, video");

    await submitAndWait(page, "Create issue", /\/dashboard\/issues\/[a-f0-9]{24}\?created=1$/);
    await expect(page.getByRole("status")).toContainText("Your issue has been submitted.");
    await expect(pageErrors).toEqual([]);

    // The submitted case is internal, so it must not appear in the library list.
    await page.goto("/dashboard/issues");
    await expect(page.getByText(title)).toHaveCount(0);

    // Staff see the request with the student's identity from the session.
    const adminContext = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
      baseURL,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`/dashboard/issues?q=${encodeURIComponent(title)}`);
    const issueHeading = adminPage.getByRole("heading", { name: title });
    // The list card is an <article> whose title link is stretched over it
    // (issue-card.tsx), so the heading sits inside the article, not an <a>.
    const issueCard = adminPage.locator("article").filter({ has: issueHeading });
    await expect(issueHeading).toBeVisible();
    await expect(issueCard).toContainText("student@hablu-programmer.com");

    // The student's video link and optional course context are preserved.
    await issueHeading.click();
    await expect(adminPage).toHaveURL(/\/dashboard\/issues\/[a-f0-9]{24}(\?returnTo=|$)/);
    await expect(adminPage.getByRole("heading", { name: "Video Links" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: /Walkthrough/ })).toBeVisible();
    await expect(adminPage.getByText("jfwd")).toBeVisible();

    await adminContext.close();
  });

  test("staff answer in the editor, and the student follows up in one too", async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL as string;
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create issue");
    await form.locator('input[name="title"]').fill(`E2E follow-up ${Date.now()}`);
    await fillIssueDetails(form, "The quiz page shows a spinner forever after I press submit.");
    await chooseStudentCourse(form);
    await submitAndWait(page, "Create issue", /\/dashboard\/issues\/[a-f0-9]{24}\?created=1$/);
    const issuePath = new URL(page.url()).pathname;

    // Staff write the first response with the editor; it is sent as Markdown.
    const adminContext = await browser.newContext({ storageState: "e2e/.auth/admin.json", baseURL });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(issuePath);
    const composer = formFor(adminPage, "Add response");
    const response = composer.getByRole("textbox", { name: "Response", exact: true });
    await response.click();
    await adminPage.keyboard.type("Clear the cache and run ");
    await adminPage.keyboard.type("`npm run dev`");
    await expect(markdownValue(composer, "body")).toHaveValue("Clear the cache and run `npm run dev`");
    await composer.getByRole("button", { name: "Add response" }).click();
    const staffReply = adminPage.locator('[data-testid^="reply-"]').filter({ hasText: "Clear the cache" });
    await expect(staffReply.locator("code")).toHaveText("npm run dev");
    // The sent response left the editor.
    await expect(markdownValue(formFor(adminPage, "Add response"), "body")).toHaveValue("");
    await adminContext.close();

    // The student replies in the same kind of editor.
    await page.goto(issuePath);
    const followUp = formFor(page, "Send reply");
    const sendReply = followUp.getByRole("button", { name: "Send reply" });
    await sendReply.click();
    await expect(followUp.getByRole("alert")).toContainText("Write your message before sending.");
    await fillMarkdownEditor(followUp, "Message", "body", "Still stuck after clearing the cache.");
    await expect(followUp.getByRole("alert")).toHaveCount(0);
    await sendReply.click();
    await expect(page.getByText("Still stuck after clearing the cache.")).toBeVisible();
    await expect(markdownValue(formFor(page, "Send reply"), "body")).toHaveValue("");
  });

  test("requires useful details and stays responsive", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/issues/new");

    const form = formFor(page, "Create issue");
    const details = issueDetailsEditor(form);
    await form.locator('input[name="title"]').fill("Assignment page does not load");
    // Course first, so only the details rule can stop the submit.
    await chooseStudentCourse(form);
    await fillIssueDetails(form, "Page broken");
    await form.getByRole("button", { name: "Create issue" }).click();
    await expect(page).toHaveURL("/dashboard/issues/new");
    // The hidden Markdown input has no native validation: the form explains
    // the problem itself and puts the caret back in the editor.
    await expect(form.getByRole("alert")).toContainText("Add at least 40 characters");
    await expect(details).toBeFocused();
    await expect(details).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Create issue" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("never exposes staff surfaces", async ({ page }) => {
    await page.goto("/dashboard/issues");

    // Students get only the self-service entry point, never staff actions.
    await expect(page.getByRole("link", { name: "Create an issue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New Issue" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit issue details" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add response" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Update status" })).toHaveCount(0);

    // The staff dashboard is not in the student nav and redirects to the library.
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard\/issues/);
  });
});

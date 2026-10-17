import { test, expect } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

/**
 * Student self-service: a STUDENT may submit an issue and nothing else.
 *
 * The case is prepared by the student and then asserted from the staff side, so
 * this proves both the create path and that the request lands as an internal
 * case owned by the submitting account.
 */
test.describe("STUDENT issue submission", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("submits a request that staff can pick up", async ({ page, browser }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const baseURL = test.info().project.use.baseURL as string;
    const title = `E2E student request ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    await expect(page.getByRole("heading", { name: "Submit a support request" })).toBeVisible();

    const form = formFor(page, "Submit request");
    // The student picks no identity — it is derived from the session.
    await expect(form.locator('input[name="studentEmail"]')).toHaveCount(0);
    await expect(form.locator('textarea[name="fileLinks"]')).toHaveCount(0);
    await form.locator('input[name="title"]').fill(title);
    await form
      .locator('textarea[name="question"]')
      .fill("The lecture video keeps buffering on the third module.");
    // Uploaded screenshots are covered in attachments.spec.ts; videos remain
    // external HTTPS links.
    await form
      .locator('textarea[name="videoLinks"]')
      .fill("Walkthrough|https://youtu.be/demo123|01:30|Shows the buffering");

    await submitAndWait(page, "Submit request", /\/dashboard\/issues\/submitted$/);
    await expect(
      page.getByRole("heading", { name: "Your request has been submitted" }),
    ).toBeVisible();
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
    await adminPage.goto("/dashboard/issues");
    const issueHeading = adminPage.getByRole("heading", { name: title });
    const issueCard = adminPage.locator("a").filter({ has: issueHeading });
    await expect(issueHeading).toBeVisible();
    await expect(issueCard).toContainText("student@hablu-programmer.com");

    // The student's video link is preserved end-to-end on the internal case.
    await issueHeading.click();
    await expect(adminPage).toHaveURL(/\/dashboard\/issues\/[a-f0-9]{24}$/);
    await expect(adminPage.getByRole("heading", { name: "Video Links" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: /Walkthrough/ })).toBeVisible();

    await adminContext.close();
  });

  test("never exposes staff surfaces", async ({ page }) => {
    await page.goto("/dashboard/issues");

    // Students get only the self-service entry point, never staff actions.
    await expect(page.getByRole("link", { name: "Submit an issue" })).toBeVisible();
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

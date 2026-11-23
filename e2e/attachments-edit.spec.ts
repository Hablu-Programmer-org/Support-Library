import { test, expect } from "@playwright/test";

import { fillMarkdownEditor, formFor, submitAndWait } from "./form-helpers";
import { tinyPngFile } from "./image-fixture";

test.describe("edit-mode attachments", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("an admin can preview and replace an old image attachment", async ({ page }) => {
    const title = `E2E edit attach ${Date.now()}`;

    // --- create an issue with one image attachment ---
    await page.goto("/dashboard/issues/new");
    const createForm = formFor(page, "Create Issue");
    await createForm.locator('input[name="studentName"]').fill("E2E Attachment Student");
    await createForm.locator('input[name="studentEmail"]').fill(`e2e.attach.${Date.now()}@test.com`);
    await createForm.locator('input[name="title"]').fill(title);
    await fillMarkdownEditor(createForm, "Issue details", "question", "This request verifies that an existing image can be replaced safely in edit mode.");
    await createForm.locator('input[name="solveIssue"]').uncheck();

    await createForm.locator('input[name="uploads"]').setInputFiles(tinyPngFile("old.png"));

    await submitAndWait(page, "Create Issue", /\/dashboard\/issues\/\d{6}$/);
    await expect(page.getByRole("heading", { name: "Attachments" })).toBeVisible();
    await expect(page.locator('img[alt="old.png"]')).toBeVisible();

    const issueUrl = page.url();

    // --- edit: remove the old one, add a new one ---
    await page.goto(`${issueUrl}/edit`);
    const editForm = formFor(page, "Save Issue");

    const existingPreview = editForm.locator('img[alt="old.png"]');
    await expect(existingPreview).toBeVisible();
    // The thumbnail is a preview button around a plain <img> served by the authenticated route.
    await expect(existingPreview).toHaveAttribute("src", /\/api\/attachments\/[a-f0-9]{24}$/);
    await expect(editForm.getByRole("button", { name: "Preview old.png" })).toBeVisible();
    await editForm.locator('input[name="removeUploadIds"][value]').first().check();
    await editForm.locator('input[name="uploads"]').setInputFiles(tinyPngFile("new.png"));

    await submitAndWait(page, "Save Issue", /\/dashboard\/issues\/\d{6}$/);

    await expect(page.locator('img[alt="old.png"]')).toHaveCount(0);
    await expect(page.locator('img[alt="new.png"]')).toBeVisible();
  });
});

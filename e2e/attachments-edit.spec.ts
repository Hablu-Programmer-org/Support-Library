import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

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
    await createForm.locator('textarea[name="question"]').fill("Edit-mode attachment test.");
    await createForm.locator('input[name="solveIssue"]').uncheck();

    const oldPng = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oldPng, 0);
    oldPng.writeUInt32BE(13, 8);
    oldPng.write("IHDR", 12, "latin1");
    oldPng.writeUInt32BE(2, 16);
    oldPng.writeUInt32BE(3, 20);

    await createForm
      .locator('input[name="uploads"]')
      .setInputFiles({ name: "old.png", mimeType: "image/png", buffer: oldPng });

    await submitAndWait(page, "Create Issue", /\/dashboard\/issues\/[a-f0-9]{24}$/);
    await expect(page.getByRole("heading", { name: "Attachments" })).toBeVisible();
    await expect(page.locator('img[alt="old.png"]')).toBeVisible();

    const issueUrl = page.url();

    // --- edit: remove the old one, add a new one ---
    await page.goto(`${issueUrl}/edit`);
    const editForm = formFor(page, "Save Issue");

    const existingPreview = editForm.locator('img[alt="old.png"]');
    await expect(existingPreview).toBeVisible();
    await expect(existingPreview.locator("xpath=parent::a")).toHaveAttribute(
      "href",
      /\/api\/attachments\/[a-f0-9]{24}$/,
    );
    await editForm.locator('input[name="removeUploadIds"][value]').first().check();
    const newPng = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(newPng, 0);
    newPng.writeUInt32BE(13, 8);
    newPng.write("IHDR", 12, "latin1");
    newPng.writeUInt32BE(2, 16);
    newPng.writeUInt32BE(3, 20);
    await editForm
      .locator('input[name="uploads"]')
      .setInputFiles({ name: "new.png", mimeType: "image/png", buffer: newPng });

    await submitAndWait(page, "Save Issue", /\/dashboard\/issues\/[a-f0-9]{24}$/);

    await expect(page.locator('img[alt="old.png"]')).toHaveCount(0);
    await expect(page.locator('img[alt="new.png"]')).toBeVisible();
  });
});

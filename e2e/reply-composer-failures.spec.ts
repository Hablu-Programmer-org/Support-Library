import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test, expect } from "@playwright/test";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";
import { formFor } from "./form-helpers";

/**
 * The reply composer reports its failures in the form.
 *
 * Every one of these used to throw out of the server action, which replaced the
 * whole case page with "Something Went Wrong" and threw away the response the
 * mentor had just written: a rejected attachment (the real reason was hidden by
 * the error boundary), a stale CSRF token, and a reused operation id.
 *
 * The case is seeded straight into the throwaway E2E database instead of being
 * created through the UI: these tests are about the reply form, and creating a
 * case per test would spend the staff `issue.create` budget (10/min) that the
 * CRUD specs need.
 */
test.use({ storageState: "e2e/.auth/mentor.json" });

let issuePath = "";

test.beforeAll(async () => {
  await dbConnect();
  const issue = await SupportIssueModel.create({
    title: "E2E reply composer failures",
    question: "How does the reply composer report a failed save?",
    searchText: "e2e reply composer failures",
    createdBy: new mongoose.Types.ObjectId(),
    status: "OPEN",
    priority: "NORMAL",
    visibility: "INTERNAL",
  });
  issuePath = `/dashboard/issues/${String(issue._id)}`;
});

test.beforeEach(async ({ page }) => {
  await page.goto(issuePath);
});

test.describe("Reply composer failure reporting", () => {
  test("a rejected attachment shows the reason and keeps the typed response", async ({ page }) => {
    // A temp file: `test-results/` may not exist on a clean run.
    const filePath = join(tmpdir(), `reply-not-an-image-${Date.now()}.txt`);
    writeFileSync(filePath, "this is not an image");

    const replyForm = formFor(page, "Add response");
    await replyForm.locator('textarea[name="body"]').fill("Reply with a bad attachment");
    await replyForm.getByText("Add attachments or video links").click();
    await replyForm.locator('input[type="file"]').setInputFiles(filePath);
    await replyForm.getByRole("button", { name: "Add response" }).click();

    await expect(page.getByRole("alert").filter({ hasText: /not a supported image/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
    // The half-written response survives the failure.
    await expect(formFor(page, "Add response").locator('textarea[name="body"]')).toHaveValue(
      "Reply with a bad attachment",
    );
  });

  test("a stale CSRF token asks for a reload instead of crashing the page", async ({ page }) => {
    const replyForm = formFor(page, "Add response");
    await replyForm.locator('textarea[name="body"]').fill("Reply with a stale token");
    await replyForm.locator('input[name="csrfToken"]').evaluate((input) => {
      (input as HTMLInputElement).value = "v1.1.1.deadbeef.invalid";
    });
    await replyForm.getByRole("button", { name: "Add response" }).click();

    await expect(page.getByRole("alert").filter({ hasText: /session expired/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
    await expect(formFor(page, "Add response").locator('textarea[name="body"]')).toHaveValue(
      "Reply with a stale token",
    );
  });

  test("two responses written on the same page view both save", async ({ page }) => {
    const firstForm = formFor(page, "Add response");
    await firstForm.locator('textarea[name="body"]').fill("First response body");
    await firstForm.getByRole("button", { name: "Add response" }).click();
    await expect(
      page.locator('[data-testid^="reply-"]').filter({ hasText: "First response body" }),
    ).toBeVisible();

    // No reload: the composer regenerates the operation id for the new text.
    const secondForm = formFor(page, "Add response");
    await secondForm.locator('textarea[name="body"]').fill("Second response body");
    await secondForm.getByRole("button", { name: "Add response" }).click();

    await expect(
      page.locator('[data-testid^="reply-"]').filter({ hasText: "Second response body" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
  });

  test("a rejected edit keeps the editor open with what was typed", async ({ page }) => {
    const composer = formFor(page, "Add response");
    await composer.locator('textarea[name="body"]').fill("Response to edit");
    await composer.getByRole("button", { name: "Add response" }).click();

    const reply = page.locator('[data-testid^="reply-"]').filter({ hasText: "Response to edit" });
    await expect(reply).toBeVisible();

    await reply.getByRole("button", { name: "Edit", exact: true }).click();
    await reply.locator('textarea[name="body"]').fill("Edited body that must survive");
    await reply.locator('textarea[name="videoLinks"]').fill("not a usable link");
    await reply.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("alert").filter({ hasText: /Video links could not be read/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
    // The editor stays open, with the edit still in it.
    await expect(reply.locator('textarea[name="body"]')).toHaveValue("Edited body that must survive");
    await expect(reply.locator('textarea[name="videoLinks"]')).toHaveValue("not a usable link");
  });
});

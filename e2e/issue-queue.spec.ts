import { test, expect, type Page } from "@playwright/test";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";
import { STAFF_USERS } from "./fixtures/staff-users";

/**
 * Staff queue behaviour: unanswered requests first (oldest first), answered
 * requests last, and a refresh that never loses the current filter or page.
 *
 * The rows are seeded directly so the three reply states are deterministic
 * instead of depending on how many replies earlier specs happened to create.
 */

const STUDENT = STAFF_USERS.find((user) => user.role === "STUDENT")!;
const STUDENT_ID = new mongoose.Types.ObjectId(STUDENT.id);
const token = `e2equeue${Date.now()}`;

const title = (name: string) => `E2E queue ${token} ${name}`;

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async () => {
  await dbConnect();
  const oldest = new Date("2026-01-01T10:00:00.000Z");
  const middle = new Date("2026-01-02T10:00:00.000Z");
  const newest = new Date("2026-01-03T10:00:00.000Z");
  await SupportIssueModel.insertMany([
    {
      title: title("never answered"),
      question: "No staff reply yet.",
      searchText: `${token} never answered`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
      awaitingStaff: true,
      lastStaffReplyAt: null,
      lastStudentReplyAt: null,
      createdAt: oldest,
      updatedAt: newest,
    },
    {
      title: title("student replied"),
      question: "The student replied after the staff answer.",
      searchText: `${token} student replied`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
      awaitingStaff: true,
      lastStaffReplyAt: new Date("2026-01-02T09:00:00.000Z"),
      lastStudentReplyAt: middle,
      createdAt: middle,
      updatedAt: newest,
    },
    {
      title: title("answered"),
      question: "Staff answered last; the student has not replied.",
      searchText: `${token} answered`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
      awaitingStaff: false,
      lastStaffReplyAt: newest,
      lastStudentReplyAt: null,
      createdAt: newest,
      updatedAt: newest,
    },
  ]);
});

test.afterAll(async () => {
  await dbConnect();
  await SupportIssueModel.deleteMany({ title: { $regex: token } });
});

/** Row headings in render order; scoped to visible nodes only. */
const queue = (page: Page) => page.locator("main h2:visible");

test.describe("staff queue ordering", () => {
  test.use({ storageState: "e2e/.auth/mentor.json" });

  test("shows unanswered issues first and oldest first, answered last", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${token}`);

    await expect(page.getByText(`E2E queue ${token} never answered`)).toBeVisible();

    await expect.poll(async () => queue(page).allInnerTexts()).toEqual([
      title("never answered"),
      title("student replied"),
      title("answered"),
    ]);

    // Staff-only badges: no reply vs. the student's later message.
    const neverAnswered = page
      .getByRole("heading", { name: title("never answered") })
      .locator("..");
    const studentReplied = page
      .getByRole("heading", { name: title("student replied") })
      .locator("..");
    await expect(neverAnswered.getByText("No reply yet", { exact: true })).toBeVisible();
    await expect(studentReplied.getByText("Student replied", { exact: true })).toBeVisible();
  });

  test("manual refresh keeps the filter and the same ordering", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${token}`);

    await expect.poll(async () => queue(page).count()).toBe(3);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();

    await expect(page.getByText(/^Updated /).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await expect.poll(async () => queue(page).allInnerTexts()).toEqual([
      title("never answered"),
      title("student replied"),
      title("answered"),
    ]);
  });
});

test.describe("activity probe authorization", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("denies students the staff-only change signal", async ({ page }) => {
    const response = await page.request.get("/api/issues/activity");
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("does not show reply-state badges on the student list", async ({ page }) => {
    await page.goto("/dashboard/issues");
    await expect(page.getByText("No reply yet")).toHaveCount(0);
    await expect(page.getByText("Student replied")).toHaveCount(0);
  });
});

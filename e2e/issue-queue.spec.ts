import { test, expect, type Page } from "@playwright/test";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { SupportIssueModel, SupportReplyModel } from "../models";
import { STAFF_USERS } from "./fixtures/staff-users";

/**
 * Staff queue behaviour: unresolved answer-needed requests first (newest
 * activity first), answered unresolved requests next and solved requests last.
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
    // Legacy rows: created before the reply-state fields existed. They must not
    // be labelled "No reply yet" just because the backfill has not run yet.
    {
      title: title("legacy answered"),
      question: "Answered before the reply-state fields existed.",
      searchText: `${token} legacy answered`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
      createdAt: new Date("2026-01-04T10:00:00.000Z"),
      updatedAt: newest,
    },
    {
      title: title("legacy unanswered"),
      question: "Never answered, created before the fields existed.",
      searchText: `${token} legacy unanswered`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
      createdAt: new Date("2026-01-05T10:00:00.000Z"),
      updatedAt: newest,
    },
    {
      title: title("old solved"),
      question: "A completed request must stay below every unresolved request.",
      searchText: `${token} old solved`,
      createdBy: STUDENT_ID,
      status: "SOLVED",
      priority: "NORMAL",
      visibility: "INTERNAL",
      awaitingStaff: true,
      lastStaffReplyAt: null,
      lastStudentReplyAt: null,
      createdAt: new Date("2025-01-01T10:00:00.000Z"),
      updatedAt: oldest,
    },
  ]);

  const legacyAnswered = await SupportIssueModel.findOne({ title: title("legacy answered") }).select("_id").lean();
  if (legacyAnswered) {
    // Mongoose applies the schema default on insert, so simulate a genuinely
    // pre-migration row by removing the fields at the driver level.
    await SupportIssueModel.collection.updateMany(
      { _id: { $in: [legacyAnswered._id] } },
      { $unset: { awaitingStaff: "", lastStaffReplyAt: "", lastStudentReplyAt: "" } },
    );
    // `isStaffReply` is deliberately omitted too: the read path must fall back to
    // the author's role, exactly like the migration does.
    const reply = await SupportReplyModel.create({
      issueId: legacyAnswered._id,
      authorId: new mongoose.Types.ObjectId(STAFF_USERS[1].id),
      body: "Legacy staff answer.",
    });
    await SupportReplyModel.collection.updateOne({ _id: reply._id }, { $unset: { isStaffReply: "" } });
  }
  const legacyUnanswered = await SupportIssueModel.findOne({ title: title("legacy unanswered") }).select("_id").lean();
  if (legacyUnanswered) {
    await SupportIssueModel.collection.updateOne(
      { _id: legacyUnanswered._id },
      { $unset: { awaitingStaff: "", lastStaffReplyAt: "", lastStudentReplyAt: "" } },
    );
  }
});

test.afterAll(async () => {
  await dbConnect();
  const issues = await SupportIssueModel.find({ title: { $regex: token } }).select("_id").lean();
  await SupportReplyModel.deleteMany({ issueId: { $in: issues.map((issue) => issue._id) } });
  await SupportIssueModel.deleteMany({ title: { $regex: token } });
});

/** Row headings in render order; scoped to visible nodes only. */
const queue = (page: Page) => page.locator("main h2:visible");

test.describe("staff queue ordering", () => {
  test.use({ storageState: "e2e/.auth/mentor.json" });

  test("shows newest answer-needed unresolved first and solved last", async ({ page }) => {
    // Explicit `sort=answer`: a bare `?q=` now defaults to relevance ranking,
    // which is not the queue order this suite asserts.
    await page.goto(`/dashboard/issues?q=${token}&sort=answer`);

    await expect(page.getByText(`E2E queue ${token} never answered`)).toBeVisible();

    await expect.poll(async () => queue(page).allInnerTexts()).toEqual([
      title("legacy unanswered"),
      title("student replied"),
      title("never answered"),
      title("legacy answered"),
      title("answered"),
      title("old solved"),
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
    await page.goto(`/dashboard/issues?q=${token}&sort=answer`);

    await expect.poll(async () => queue(page).count()).toBe(6);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();

    await expect(page.getByText(/^Updated /).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await expect.poll(async () => queue(page).allInnerTexts()).toEqual([
      title("legacy unanswered"),
      title("student replied"),
      title("never answered"),
      title("legacy answered"),
      title("answered"),
      title("old solved"),
    ]);
  });

  test("does not label a legacy answered issue as no reply", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${token}&sort=answer`);

    const legacyAnswered = page
      .getByRole("heading", { name: title("legacy answered") })
      .locator("..");
    const legacyUnanswered = page
      .getByRole("heading", { name: title("legacy unanswered") })
      .locator("..");

    // The pre-migration reply is derived from the author's role on read.
    await expect(legacyAnswered.getByText("No reply yet", { exact: true })).toHaveCount(0);
    await expect(legacyUnanswered.getByText("No reply yet", { exact: true })).toBeVisible();
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

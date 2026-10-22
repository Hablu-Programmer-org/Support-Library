import { test, expect } from "@playwright/test";
import mongoose from "mongoose";

import { caseRefFor, dayKeyInDhaka } from "../lib/config/live-support";
import { dbConnect } from "../lib/db";
import {
  LiveSupportJoinModel,
  SupportIssueModel,
  SupportReplyModel,
} from "../models";
import { formFor, submitAndWait } from "./form-helpers";
import { STAFF_USERS } from "./fixtures/staff-users";

/**
 * Live support is reached from a request, and only from a request.
 *
 * A student submits a request, lands on its own page, and joins the room from
 * there — the request is fixed by the page, so there is no picker and no room on
 * any page without an owned request. Staff run the session from
 * `/dashboard/support` and see who is waiting in the queue.
 *
 * The shift matrix (open/closed) is decided on the server and covered by
 * `__tests__/live-support.test.ts` and `__tests__/live-support-panel.test.tsx`,
 * because Playwright's clock cannot move the server's clock.
 */

const STUDENT = STAFF_USERS.find((user) => user.role === "STUDENT")!;
const STUDENT_ID = new mongoose.Types.ObjectId(STUDENT.id);

/** Only this student's requests are removed, and only in the E2E database. */
async function resetStudentRequests() {
  await dbConnect();
  const owned = await SupportIssueModel.find({ createdBy: STUDENT_ID }, "_id").lean();
  const issueIds = owned.map((issue) => issue._id);

  await Promise.all([
    SupportReplyModel.deleteMany({ issueId: { $in: issueIds } }),
    LiveSupportJoinModel.deleteMany({ studentUserId: STUDENT_ID }),
    SupportIssueModel.deleteMany({ createdBy: STUDENT_ID }),
  ]);
}

const REQUEST_URL = /\/dashboard\/issues\/[a-f0-9]{24}\?created=1$/;

test.describe("LIVE support: sign-in gate", () => {
  test("sends guests to login, remembering the page they wanted", async ({ page }) => {
    await page.goto("/dashboard/support");
    await expect(page).toHaveURL("/login?callbackUrl=%2Fdashboard%2Fsupport");
  });
});

test.describe("STUDENT: a request is the way into the room", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test.beforeAll(async () => {
    await resetStudentRequests();
  });

  test("submitting lands on the request with its live support panel", async ({ page }) => {
    const title = `E2E live support request ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    const requestForm = formFor(page, "Submit request");
    await requestForm.locator('input[name="title"]').fill(title);
    await requestForm
      .locator('textarea[name="question"]')
      .fill("The mentor needs the reference in the room.");
    await submitAndWait(page, "Submit request", REQUEST_URL);

    // The confirmation is the request page itself, not a dead end.
    await expect(page.getByRole("status")).toContainText("Your request has been submitted.");
    await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live support" }).first()).toBeVisible();

    // The room URL is not part of the document; the panel posts to an action.
    expect(await page.content()).not.toContain("zoom.us");
  });

  test("finds the request again in My requests", async ({ page }) => {
    await page.goto("/dashboard/my-requests");

    await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();
    // The request created above is listed with its status and links to itself.
    // "/dashboard/issues/new" is the header CTA, so the row is the one with a
    // last-updated line.
    const row = page
      .locator('a[href^="/dashboard/issues/"]')
      .filter({ hasText: "Updated" })
      .first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("Open");
  });

  test("cannot open another owner's unpublished request", async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL as string;
    const title = `E2E foreign request ${Date.now()}`;

    // Prepared by an admin, for a student identity that is not the viewer.
    const adminContext = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
      baseURL,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/dashboard/issues/new");
    const form = formFor(adminPage, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Foreign Student");
    await form.locator('input[name="studentEmail"]').fill(`foreign.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill(title);
    await form.locator('textarea[name="question"]').fill("Not yours to read.");
    await submitAndWait(adminPage, "Create Issue", /\/dashboard\/issues\/[a-f0-9]{24}$/);
    const issuePath = new URL(adminPage.url()).pathname;
    await adminContext.close();

    // The owner scope is `createdBy`, so a real student still gets a 404.
    await page.goto(issuePath);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("is sent from the staff room page to their requests", async ({ page }) => {
    await page.goto("/dashboard/support");
    await expect(page).toHaveURL(/\/dashboard\/my-requests$/);
  });

  test("has no Live support item in the nav, but has My requests", async ({ page }) => {
    await page.goto("/dashboard/issues");

    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link", { name: "My requests" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Live support" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Support queue" })).toHaveCount(0);
  });

  test("keeps the staff queue out of reach", async ({ page }) => {
    await page.goto("/dashboard/live-support");
    await expect(page).toHaveURL(/\/unauthorized$/);
  });
});

test.describe("STAFF: they run the room", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  let studentRequestPath = "";

  test.beforeAll(async () => {
    await dbConnect();
    const issue = await SupportIssueModel.create({
      title: "E2E staff view request",
      question: "Seeded so staff can open a student-owned request.",
      searchText: "e2e staff view request seeded",
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
    });
    studentRequestPath = `/dashboard/issues/${String(issue._id)}`;
  });

  test("joins without a request and sees no student panel", async ({ page }) => {
    await page.goto("/dashboard/support");

    await expect(page.getByRole("heading", { name: "Live support" })).toBeVisible();
    await expect(page.getByText(/You are joining as staff/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Waiting students" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Live Support Center (Zoom)" })).toHaveCount(1);
  });

  test("sees the student request without the student's join panel", async ({ page }) => {
    // Staff read the internal case view; the student's request-page panel must
    // never appear there (the join path belongs to the owner).
    await page.goto(studentRequestPath);

    await expect(page.getByRole("heading", { name: "Issue context" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live support" })).toHaveCount(0);
  });
});

test.describe("LIVE support: staff queue", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  let caseRef = "";

  test.beforeAll(async () => {
    await dbConnect();

    // Seeded rather than clicked, because a real join needs an open shift and
    // the server clock cannot be moved from Playwright.
    const issue = await SupportIssueModel.create({
      title: "E2E live support queue request",
      question: "Seeded to assert the waiting list.",
      searchText: "e2e live support queue request seeded",
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
    });
    caseRef = caseRefFor(String(issue._id));

    await LiveSupportJoinModel.create({
      issueId: issue._id,
      studentUserId: STUDENT_ID,
      shift: "morning",
      dayKey: dayKeyInDhaka(new Date()),
      joinedAt: new Date(),
    });

    // A join row outlives the case: seed a solved request that was also taken to
    // the room today, so the list can prove it is no longer called "waiting".
    const solved = await SupportIssueModel.create({
      title: "E2E solved live support request",
      question: "Seeded to assert a solved case is not marked waiting.",
      searchText: "e2e solved live support request seeded",
      createdBy: STUDENT_ID,
      status: "SOLVED",
      priority: "NORMAL",
      visibility: "INTERNAL",
    });

    await LiveSupportJoinModel.create({
      issueId: solved._id,
      studentUserId: STUDENT_ID,
      shift: "morning",
      dayKey: dayKeyInDhaka(new Date()),
      joinedAt: new Date(),
    });
  });

  test("lists who is waiting and which request they brought", async ({ page }) => {
    await page.goto("/dashboard/live-support");

    await expect(page.getByRole("heading", { name: "Live support queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting today" })).toBeVisible();
    await expect(page.getByText("E2E live support queue request")).toBeVisible();
    await expect(page.getByText(caseRef)).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E live support queue request" })).toBeVisible();
    // The queue is kept current without a manual reload.
    await expect(page.getByRole("button", { name: /Refresh/ })).toBeVisible();
  });

  test("shows the waiting student on the staff dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Waiting Now")).toBeVisible();
    await expect(page.getByText("Waiting today")).toBeVisible();

    // The same request shows up in both staff views: the room queue and the
    // "no mentor yet" list.
    const queue = page.getByRole("region", { name: "Waiting today" });
    await expect(queue.getByText("E2E live support queue request")).toBeVisible();

    const awaiting = page.getByRole("region", {
      name: "Student requests awaiting a mentor",
    });
    await expect(awaiting.getByText("E2E live support queue request")).toBeVisible();
  });

  test("marks the issue as waiting in the staff issues list", async ({ page }) => {
    await page.goto("/dashboard/issues");

    await expect(page.getByText("Waiting in live support").first()).toBeVisible();
  });

  test("stops calling a case waiting once it is solved", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${encodeURIComponent("solved live support request")}`);

    const row = page
      .locator("a")
      .filter({ hasText: "E2E solved live support request" })
      .first();
    await expect(row).toBeVisible();
    // The join happened today, but a solved request is not waiting for anyone.
    await expect(row.getByText("Waiting in live support")).toHaveCount(0);
  });

  test("is reached from the staff room page", async ({ page }) => {
    await page.goto("/dashboard/support");
    await page.getByRole("link", { name: "Waiting students" }).click();

    await expect(page.getByRole("heading", { name: "Live support queue" })).toBeVisible();
  });
});

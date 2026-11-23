import { test, expect } from "@playwright/test";
import mongoose from "mongoose";

import { dayKeyInDhaka } from "../lib/config/live-support";
import { dbConnect } from "../lib/db";
import {
  LiveSupportJoinModel,
  SupportIssueModel,
  SupportReplyModel,
} from "../models";
import { chooseStudentCourse, fillIssueDetails, fillMarkdownEditor, formFor, submitAndWait } from "./form-helpers";
import { STAFF_USERS } from "./fixtures/staff-users";
import { resetStudentCreateBudget } from "./fixtures/student-create-budget";

/**
 * Live support is reached from a request, and only from a request.
 *
 * A student submits a request, lands on its own page, and joins the room from
 * there — the request is fixed by the page, so there is no picker and no room on
 * any page without an owned request. Staff run the session from
 * `/dashboard/live-support`: the room card and today's queue on one page.
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

const REQUEST_URL = /\/dashboard\/issues\/\d{6}\?created=1$/;

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
    await resetStudentCreateBudget();
  });

  test("submitting lands on the request with its live support panel", async ({ page }) => {
    const title = `E2E live support request ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    const requestForm = formFor(page, "Create issue");
    await requestForm.locator('input[name="title"]').fill(title);
    await fillIssueDetails(requestForm, "The mentor needs this request reference to investigate the issue during the support room.");
    // Course is required for an account with LMS enrolments.
    await chooseStudentCourse(requestForm);
    await submitAndWait(page, "Create issue", REQUEST_URL);

    // The confirmation is the request page itself, not a dead end.
    await expect(page.getByRole("status")).toContainText("Your issue has been submitted.");
    await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live support" }).first()).toBeVisible();

    // The room URL is not part of the document; the panel posts to an action.
    expect(await page.content()).not.toContain("meet.google.com");
    // The platform is an identifier, not copy: the panel says "Join Live support".
    expect(await page.content()).not.toContain("Google Meet");
  });

  test("finds the issue again in My issues", async ({ page }) => {
    await page.goto("/dashboard/my-issues");

    await expect(page.getByRole("heading", { name: "My issues" })).toBeVisible();
    // The request created above is listed with its status and links to itself.
    // The card's link holds only the title, so find the card by its
    // last-updated line, then check the one link inside it.
    const row = page
      .getByTestId("my-issue-card")
      .filter({ hasText: "Updated" })
      .first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("Open");
    await expect(row.getByRole("link")).toHaveAttribute(
      "href",
      /^\/dashboard\/issues\/\d{6}$/,
    );
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
    await fillMarkdownEditor(form, "Issue details", "question", "This unpublished request belongs to another student and must remain private.");
    await submitAndWait(adminPage, "Create Issue", /\/dashboard\/issues\/\d{6}$/);
    const issuePath = new URL(adminPage.url()).pathname;
    await adminContext.close();

    // The owner scope is `createdBy`, so a real student still gets a 404.
    await page.goto(issuePath);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("is sent from the staff room page to their requests", async ({ page }) => {
    await page.goto("/dashboard/support");
    await expect(page).toHaveURL(/\/dashboard\/my-issues$/);
  });

  test("an old my-requests link lands on my-issues", async ({ page }) => {
    await page.goto("/dashboard/my-requests");
    await expect(page).toHaveURL(/\/dashboard\/my-issues$/);
  });

  test("has no Live support item in the nav, but has My issues", async ({ page }) => {
    await page.goto("/dashboard/issues");

    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link", { name: "My issues" })).toBeVisible();
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
    await page.goto("/dashboard/live-support");

    await expect(page.getByRole("heading", { name: "Live support", exact: true })).toBeVisible();
    await expect(page.getByText(/You join as staff/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting today" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Join Live support" }),
    ).toHaveCount(1);
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
      caseRef: "900001",
    });
    caseRef = "900001";

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
      caseRef: "900002",
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

    await expect(page.getByRole("heading", { name: "Live support", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting today" })).toBeVisible();
    // `.first()` because the streamed page can briefly hold the row twice while
    // the loading boundary swaps out (the settled DOM has it once).
    await expect(page.getByText("E2E live support queue request").first()).toBeVisible();
    await expect(page.getByText(caseRef).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "E2E live support queue request" }).first(),
    ).toBeVisible();
    // The queue is kept current without a manual reload.
    await expect(page.getByRole("button", { name: /Refresh/ })).toBeVisible();
  });

  test("shows the waiting student on the staff dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Waiting now", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting today" })).toBeVisible();

    // The same request shows up in both staff views: the room queue and the
    // "no mentor yet" list.
    const queue = page.getByRole("region", { name: "Waiting today" });
    await expect(queue.getByText("E2E live support queue request").first()).toBeVisible();

    const awaiting = page.getByRole("region", { name: "Needs a mentor" });
    await expect(awaiting.getByText("E2E live support queue request").first()).toBeVisible();
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

  test("an old staff room link lands on the merged page", async ({ page }) => {
    await page.goto("/dashboard/support");

    await expect(page).toHaveURL(/\/dashboard\/live-support$/);
    await expect(page.getByRole("button", { name: "Join Live support" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Waiting today" })).toBeVisible();
  });
});

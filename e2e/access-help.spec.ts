import { expect, test } from "@playwright/test";

test.describe("student access help", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("shows all access choices directly below issue search", async ({ page }) => {
    await page.goto("/dashboard/issues");
    const search = page.getByPlaceholder(/Search by problem/);
    const card = page.getByRole("region", { name: "Help & access" });
    await expect(search).toBeVisible();
    await expect(card).toBeVisible();
    expect(await search.evaluate((element) => element.compareDocumentPosition(document.querySelector('[aria-labelledby="access-help-heading"]')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();

    await expect(card.getByRole("group", { name: "Choose access requests" })).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /n8n access/i })).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /n8n password reset/i })).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /OpenAI API access/i })).toBeVisible();
    await expect(card.getByText("n8n: 1 year · OpenAI: 2 months")).toBeVisible();
    await expect(card.getByText("Select the access you need.")).toBeVisible();
    await expect(card.getByText(/No API key is emailed/i)).toHaveCount(0);

    // Desktop layout: options and the send button share one row.
    const optionTops = await card.locator('label:has(input[name="requestTypes"])').evaluateAll((labels) =>
      labels.map((label) => Math.round(label.getBoundingClientRect().top)),
    );
    const buttonTop = await card
      .getByRole("button", { name: "Submit request" })
      .evaluate((button) => Math.round(button.getBoundingClientRect().top));
    expect(new Set([...optionTops, buttonTop]).size).toBe(1);

    // The message stays on a single line on desktop.
    const messageWhiteSpace = await card
      .getByText("Select the access you need.")
      .evaluate((element) => getComputedStyle(element).whiteSpace);
    expect(messageWhiteSpace).toBe("nowrap");

    // Mobile wraps instead of overflowing.
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
  });
});

test.describe("student access help gating", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("does not expose AI-tools access to students outside the agent course", async ({ page }) => {
    const lmsDb = process.env.LMS_MONGODB_DB;
    if (!lmsDb) throw new Error("LMS_MONGODB_DB is missing");
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(process.env.MONGODB_URI ?? "");
    await client.connect();
    const db = client.db(lmsDb);
    const lmsUser = await db.collection("User").findOne({ email: "student@hablu-programmer.com" }, { projection: { _id: 1 } });
    if (!lmsUser?._id) throw new Error("E2E student missing in LMS");

    await db.collection("EnrolledCourse").deleteOne({ userId: lmsUser._id, courseSlug: "agent" });
    try {
      await page.goto("/dashboard/issues");
      await expect(page.getByRole("region", { name: "Help & access" })).toHaveCount(0);
      await expect(page.getByRole("checkbox", { name: /n8n access/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Submit request" })).toHaveCount(0);
    } finally {
      await db.collection("EnrolledCourse").updateOne(
        { userId: lmsUser._id, courseSlug: "agent" },
        {
          $set: { batchNo: 4, status: "running", email: "student@hablu-programmer.com" },
          $setOnInsert: { _id: new (await import("mongodb")).ObjectId() },
        },
        { upsert: true },
      );
      await client.close();
    }
  });
});

test.describe("access request administration", () => {
  test("allows admins and denies mentors", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    await admin.grantPermissions(["clipboard-read", "clipboard-write"]);
    const adminPage = await admin.newPage();
    await adminPage.goto("/dashboard/access-requests");
    await expect(adminPage.getByRole("heading", { name: "Access requests" })).toBeVisible();

    // Two tabs, each carrying its own pending count. Sent rows are hidden until
    // the admin asks for them.
    const openAiTab = adminPage.getByRole("button", { name: /^OpenAI/ });
    const n8nTab = adminPage.getByRole("button", { name: /^n8n/ });
    await expect(openAiTab).toHaveAttribute("aria-pressed", "true");
    await expect(openAiTab).toContainText("0 pending");
    await expect(n8nTab).toContainText("0 pending");
    await expect(adminPage.getByRole("checkbox", { name: "Show completed" })).not.toBeChecked();
    await expect(adminPage.getByRole("region", { name: "OpenAI API access" })).toBeVisible();

    await adminPage.getByText("Create requests manually", { exact: true }).click();
    await adminPage.getByLabel("Student email", { exact: true }).fill("e2e.lms.student@test.com");
    await adminPage.getByRole("checkbox", { name: "n8n access" }).check();
    await adminPage.getByRole("checkbox", { name: "OpenAI API access" }).check();
    await adminPage.getByRole("button", { name: "Create requests" }).click();
    await expect(adminPage.getByRole("status")).toContainText("2 requests created");

    // The OpenAI tab is open by default and shows only its own request.
    const openAiQueue = adminPage.getByRole("region", { name: "OpenAI API access" });
    await expect(openAiTab).toContainText("1 pending");
    await expect(n8nTab).toContainText("1 pending");
    await expect(openAiQueue.getByText("Admin created")).toHaveCount(1);
    const copyEmail = openAiQueue.getByRole("button", { name: /Copy e2e\.lms\.student@test\.com/i });
    await expect(copyEmail).toBeVisible();
    await expect(openAiQueue.getByText("Copy email", { exact: true })).toHaveCount(0);
    await copyEmail.click();
    await expect(openAiQueue.getByText("Copied", { exact: true })).toBeVisible();
    expect(await adminPage.evaluate(() => navigator.clipboard.readText())).toBe(
      "e2e.lms.student@test.com",
    );
    await expect(adminPage.locator('input[name="link"]')).toHaveCount(0);

    // The queue is a compact list: final actions are available directly without
    // an intermediate Process control.
    await expect(openAiQueue.getByText("Batch 4", { exact: true })).toBeVisible();
    await expect(openAiQueue.getByText("Never granted OpenAI access")).toBeVisible();
    await expect(openAiQueue.getByRole("button", { name: "Process" })).toHaveCount(0);
    const openAiConfirmation = openAiQueue.getByRole("checkbox", { name: "Added this exact email" });
    const confirmButton = openAiQueue.getByRole("button", { name: "Confirm & email student" });
    await expect(confirmButton).toBeDisabled();
    await openAiQueue.getByText("Added this exact email", { exact: true }).click();
    await expect(openAiConfirmation).toBeChecked();
    await expect(confirmButton).toBeEnabled();

    // The n8n tab keeps both n8n request types and its own link form.
    await n8nTab.click();
    await expect(n8nTab).toHaveAttribute("aria-pressed", "true");
    const n8nQueue = adminPage.getByRole("region", { name: "n8n access & password reset" });
    await expect(n8nQueue.getByText("Admin created")).toHaveCount(1);
    const n8nLink = n8nQueue.getByLabel("n8n link");
    const sendEmail = n8nQueue.getByRole("button", { name: "Send email" });
    await expect(n8nLink).toBeVisible();
    await expect(sendEmail).toBeDisabled();
    await n8nLink.fill("https://n8n.hablu-programmer.com/invite/test");
    await expect(sendEmail).toBeEnabled();

    // Geometry guard: the link input keeps the space, the action stays compact.
    const linkBox = await n8nLink.boundingBox();
    const sendBox = await sendEmail.boundingBox();
    expect(linkBox!.width).toBeGreaterThanOrEqual(180);
    expect(linkBox!.width).toBeLessThan(520);
    expect(sendBox!.width).toBeLessThan(linkBox!.width);

    // Send and Reject share one line: the reject control must not drop below.
    const rejectBox = await n8nQueue.getByRole("button", { name: "Reject" }).first().boundingBox();
    expect(Math.abs(rejectBox!.y - sendBox!.y)).toBeLessThan(8);

    // Email search is server-side and live: no submit button, and it survives a
    // refresh because the query lives in the URL.
    const search = adminPage.getByRole("searchbox", { name: "Search by student email" });
    await search.fill("e2e.lms.student@test.com");
    await expect(adminPage).toHaveURL(/q=e2e\.lms\.student%40test\.com/);
    await expect(n8nQueue.getByText("Admin created")).toBeVisible();
    await search.fill("nobody@test.com");
    await expect(n8nQueue.getByText(/No pending n8n requests match/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Clear email search" }).click();
    await expect(n8nQueue.getByText("Admin created")).toBeVisible();

    // The sent toggle changes the query without hiding pending work.
    await adminPage.getByRole("checkbox", { name: "Show completed" }).check();
    await expect(adminPage).toHaveURL(/sent=1/);
    await expect(n8nQueue.getByText("Admin created")).toBeVisible();

    await adminPage.setViewportSize({ width: 390, height: 844 });
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await admin.close();

    const mentor = await browser.newContext({ storageState: "e2e/.auth/mentor.json" });
    const mentorPage = await mentor.newPage();
    await mentorPage.goto("/dashboard/access-requests");
    await expect(mentorPage).toHaveURL(/\/unauthorized$/);
    await mentor.close();
  });
});

import { test, expect } from "@playwright/test";

import { chooseStudentCourse, formFor, submitAndWait } from "./form-helpers";
import { TINY_PNG, tinyPngFile } from "./image-fixture";

/**
 * Uploaded image attachments: stored server-side and served only through the
 * authorized download route. Staff, the uploader and the case owner can read
 * them while the case is internal; publishing makes them readable by every
 * signed-in student.
 */
test.describe("uploaded attachments", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("a student can attach an image and staff can open it; strangers cannot", async ({
    page,
    browser,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const title = `E2E attachment request ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Submit request");
    await form.locator('input[name="title"]').fill(title);
    await form
      .locator('textarea[name="question"]')
      .fill("The lecture video keeps buffering on the third module.");
    // The course is required once the account has LMS enrolments.
    await chooseStudentCourse(form);

    const png = TINY_PNG;

    const uploadInput = form.locator('input[name="uploads"]');
    await uploadInput.setInputFiles([tinyPngFile("attachment.png"), tinyPngFile("remove-me.png")]);

    const localPreview = form.locator('img[alt="Preview of attachment.png"]');
    await expect(localPreview).toBeVisible();
    await expect(localPreview).toHaveAttribute("src", /^blob:/);
    await expect(form.locator('img[alt="Preview of remove-me.png"]')).toBeVisible();

    await form.getByRole("button", { name: "Remove remove-me.png" }).click();
    await expect(form.locator('img[alt="Preview of remove-me.png"]')).toHaveCount(0);
    expect(
      await uploadInput.evaluate((input: HTMLInputElement) =>
        Array.from(input.files ?? []).map((file) => file.name),
      ),
    ).toEqual(["attachment.png"]);

    await submitAndWait(page, "Submit request", /\/dashboard\/issues\/[a-f0-9]{24}\?created=1$/);
    await expect(pageErrors).toEqual([]);

    // Staff pick up the case and the selected image is visible as an attachment.
    const adminContext = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
      baseURL: test.info().project.use.baseURL as string,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/dashboard/issues");
    await adminPage.getByRole("heading", { name: title }).click();
    await expect(adminPage).toHaveURL(/\/dashboard\/issues\/[a-f0-9]{24}$/);
    await expect(adminPage.getByRole("heading", { name: "Attachments" })).toBeVisible();

    const image = adminPage.locator('img[alt="attachment.png"]');
    await expect(image).toBeVisible();
    const src = await image.getAttribute("src");
    expect(src).toMatch(/^\/api\/attachments\/[a-f0-9]{24}$/);

    const response = await adminPage.request.get(src!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect((await response.body()).length).toBe(png.length);

    // The uploader may still fetch their own file directly.
    const studentResponse = await page.request.get(src!);
    expect(studentResponse.status()).toBe(200);

    // The team answers with a screenshot. The owner of the case can now open the
    // team's image on their own request page (not just the file they uploaded).
    const replyForm = formFor(adminPage, "Add response");
    await replyForm.locator('textarea[name="body"]').fill("Look at this screenshot for the fix.");
    await replyForm.getByText("Add attachments or video links").click();
    await replyForm.locator('input[type="file"]').setInputFiles(tinyPngFile("answer.png"));
    await replyForm.getByRole("button", { name: "Add response" }).click();

    const answerImage = adminPage.locator('img[alt="answer.png"]');
    await expect(answerImage).toBeVisible();
    const answerSrc = await answerImage.first().getAttribute("src");
    expect(answerSrc).toMatch(/^\/api\/attachments\/[a-f0-9]{24}$/);

    await page.reload();
    // The request page auto-refreshes; a refresh can leave the previous tree in
    // the DOM briefly, so scope the visibility check to the first match.
    await expect(page.locator('img[alt="answer.png"]').first()).toBeVisible();
    const ownerResponse = await page.request.get(answerSrc!);
    expect(ownerResponse.status()).toBe(200);

    // An admin can remove a sensitive screenshot from the reply before publishing.
    const answerReply = adminPage
      .locator('[data-testid^="reply-"]')
      .filter({ hasText: "Look at this screenshot for the fix." });
    await answerReply.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(answerReply.getByText("Existing attachments")).toBeVisible();
    await answerReply.locator('input[name="removeUploadIds"]').check();
    await answerReply.getByRole("button", { name: "Save" }).click();
    await expect(answerReply.locator('img[alt="answer.png"]')).toHaveCount(0);
    expect((await adminPage.request.get(answerSrc!)).status()).toBe(404);

    // An unauthenticated client is turned away with 401, not a login redirect.
    const anonContext = await browser.newContext({
      baseURL: test.info().project.use.baseURL as string,
      storageState: { cookies: [], origins: [] },
    });
    const anonResponse = await anonContext.request.get(src!, { maxRedirects: 0 });
    expect(
      anonResponse.status(),
      JSON.stringify({
        url: anonResponse.url(),
        contentType: anonResponse.headers()["content-type"],
        cookies: (await anonContext.cookies()).map((cookie) => cookie.name),
      }),
    ).toBe(401);
    await anonContext.close();

    await adminContext.close();
  });

  test("a file that is not a real image is rejected with a field error", async ({ page }) => {
    const title = `E2E bad attachment ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Submit request");
    await form.locator('input[name="title"]').fill(title);
    await form
      .locator('textarea[name="question"]')
      .fill("My selected image is actually a text file and should be rejected safely.");
    await chooseStudentCourse(form);

    await form
      .locator('input[name="uploads"]')
      .setInputFiles({
        name: "attachment.png",
        mimeType: "image/png",
        buffer: Buffer.from("this is not an image"),
      });

    await form.getByRole("button", { name: "Submit request", exact: true }).click();

    // The submission must not succeed: the field error is reported in place.
    await expect(form.getByRole("alert")).toContainText(/not a supported image/i);
    await expect(page).toHaveURL(/\/dashboard\/issues\/new$/);
  });

  test("picking images twice adds them instead of replacing the first batch", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Submit request");
    await form.locator('input[name="title"]').fill(`E2E multi pick ${Date.now()}`);
    await form
      .locator('textarea[name="question"]')
      .fill("Two separate picks must both stay attached to the request.");
    await chooseStudentCourse(form);

    const uploadInput = form.locator('input[name="uploads"]');
    // Most file managers only allow one file per pick, so the same input is used
    // again — the second batch must be appended, not substituted.
    await uploadInput.setInputFiles(tinyPngFile("first.png"));
    await uploadInput.setInputFiles(tinyPngFile("second.png"));

    await expect(form.locator('img[alt="Preview of first.png"]')).toBeVisible();
    await expect(form.locator('img[alt="Preview of second.png"]')).toBeVisible();
    await expect(form.getByText("2 of 5")).toBeVisible();
    expect(
      await uploadInput.evaluate((input: HTMLInputElement) =>
        Array.from(input.files ?? []).map((file) => file.name),
      ),
    ).toEqual(["first.png", "second.png"]);
  });
});

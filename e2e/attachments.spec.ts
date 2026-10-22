import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

/**
 * Uploaded image attachments: stored server-side, never published, and served only
 * through the authorized download route.
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

    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.writeUInt32BE(13, 8);
    png.write("IHDR", 12, "latin1");
    png.writeUInt32BE(2, 16);
    png.writeUInt32BE(3, 20);

    const uploadInput = form.locator('input[name="uploads"]');
    await uploadInput.setInputFiles([
      { name: "attachment.png", mimeType: "image/png", buffer: png },
      { name: "remove-me.png", mimeType: "image/png", buffer: Buffer.from(png) },
    ]);

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
      .fill("My selected image is actually text.");

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
});

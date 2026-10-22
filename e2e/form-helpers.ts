import type { Locator, Page } from "@playwright/test";

/**
 * Next.js App Router streaming plus React hydration can transiently leave a
 * second copy of the current route's form in the DOM, so create/edit
 * interactions are scoped to a single form root (`.first()`) instead of the
 * whole page. Scoping avoids strict-mode "resolved to N elements" failures.
 */
export function formFor(page: Page, submitLabel: string) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: submitLabel, exact: true }) })
    .first();
}

/**
 * Pick the course on a student request form.
 *
 * The course is required whenever the student's LMS account has enrolments, and
 * the batch fills itself. The select does not render at all for an account with
 * no enrolment, so this is a no-op there.
 */
export async function chooseStudentCourse(form: Locator) {
  const select = form.locator('select[name="courseSlug"]');
  if ((await select.count()) === 0) return;

  const options = await select.locator("option").count();
  if (options > 1) {
    // Index 0 is the "Select your course" placeholder.
    await select.selectOption({ index: 1 });
  }
}

/**
 * A submit click that lands before React hydrates falls back to a native form
 * post and silently stays on the same URL, so retry until the route changes.
 */
export async function submitAndWait(page: Page, submitLabel: string, url: RegExp) {
  const form = formFor(page, submitLabel);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const navigated = page
      .waitForURL(url, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    await form.getByRole("button", { name: submitLabel, exact: true }).click();
    if (await navigated) return;
  }
  throw new Error(`"${submitLabel}" never navigated to ${url}`);
}

import { expect, test } from "@playwright/test";

test("public landing loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Staff Sign In" })).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
  await expect(page.getByRole("search")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('meta[name="darkreader-lock"]')).toHaveAttribute("content", "true");
});

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("health endpoints distinguish liveness and readiness", async ({ request }) => {
  const live = await request.get("/api/health/live");
  expect(live.status()).toBe(200);
  expect(await live.json()).toMatchObject({ ok: true, live: true });

  const ready = await request.get("/api/health/ready");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toMatchObject({ ok: true, ready: true });
});

test("production responses include baseline security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["strict-transport-security"]).toContain("max-age=31536000");
});

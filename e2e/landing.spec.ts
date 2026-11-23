import { expect, test, type Page } from "@playwright/test";

test.describe("Landing", () => {
  test("guest sees only the sign-in path, no library chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to get help" })).toBeVisible();
    // Guest chrome is hidden: no nav links, no search box, no student CTA.
    await expect(
      page.locator('header nav[aria-label="Primary"]').getByRole("link"),
    ).toHaveCount(0);
    await expect(page.getByRole("search")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Students: browse published answers" }),
    ).toHaveCount(0);
    // No AI access hint and no student CTA before signing in.
    await expect(
      page.getByText("Need n8n access, password reset or OpenAI access?"),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Help & access/ })).toHaveCount(0);
  });

  test("guest highlight cards are static, not links", async ({ page }) => {
    await page.goto("/");
    const cards = page.getByRole("list", { name: "Support highlights" });
    await expect(cards.getByRole("listitem")).toHaveCount(3);
    await expect(cards.getByRole("link")).toHaveCount(0);
  });

  test("cards below the fold reveal on scroll (phone)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");
    const supported = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
    test.skip(!supported, "scroll-driven animations unsupported; cards are shown at once");
    const last = page.getByRole("list", { name: "Support highlights" }).getByRole("listitem").last();
    const opacity = () => last.evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(await opacity()).toBeLessThan(1);
    await last.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(opacity).toBe(1);
  });

  test("cards are visible without scrolling when scroll animations are unsupported", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const first = page.getByRole("list", { name: "Support highlights" }).getByRole("listitem").first();
    expect(await first.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test.describe("Landing staff cards", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("staff highlight cards link to the staff routes", async ({ page }) => {
    await page.goto("/");
    // The AI access card is student-only.
    await expect(page.getByRole("link", { name: /Help & access/ })).toHaveCount(0);
    const links = page.getByRole("list", { name: "Support highlights" }).getByRole("link");
    await expect(links).toHaveCount(3);
    expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
      "/dashboard/issues",
      "/dashboard/live-support",
      "/dashboard",
    ]);
  });

  test("hover glow is a border ring and never covers the card text", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const card = page.getByRole("list", { name: "Support highlights" }).getByRole("link").first();
    const title = card.getByRole("heading", { level: 2 });
    const colorBefore = await title.evaluate((el) => getComputedStyle(el).color);
    await card.hover();
    const ring = await card.evaluate((el) => {
      const cs = getComputedStyle(el, "::before");
      return { opacity: cs.opacity, composite: cs.maskComposite || cs.getPropertyValue("-webkit-mask-composite") };
    });
    expect(ring.opacity).toBe("1");
    expect(ring.composite).toMatch(/exclude|xor/);
    expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe(colorBefore);
  });
});

/** Collects the bodies of every script the page loads. */
async function loadedScripts(page: Page) {
  const bodies: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script" && response.ok()) {
      bodies.push(response.text().catch(() => ""));
    }
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  return Promise.all(bodies);
}

// A framer-motion runtime attribute name. Unlike its motion.dev warning links
// (stripped from production), it survives minification, so it marks the
// library's chunk in both dev and production builds.
const FRAMER_MARKER = "data-framer-appear-id";

test.describe("Landing bundle (guest)", () => {
  test("guests never download framer-motion", async ({ page }) => {
    const scripts = await loadedScripts(page);
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((body) => body.includes(FRAMER_MARKER))).toHaveLength(0);
  });
});

test.describe("Landing bundle (signed in)", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  // Positive control: proves the marker actually detects the library, so the
  // guest test above cannot pass just because the marker never matches.
  test("signed-in users still get the mobile menu's framer-motion chunk", async ({ page }) => {
    const scripts = await loadedScripts(page);
    expect(scripts.some((body) => body.includes(FRAMER_MARKER))).toBe(true);
  });

  // Regression: the dynamic account sheet (now MobileMenu) once had no Suspense boundary, so its
  // pending chunk held back hydration of the whole page and the search fell
  // back to a native submit that never left "/".
  test("a slow mobile-menu chunk does not block the landing search", async ({ page }) => {
    let delayed = 0;
    let released = false;
    // Match on the path, not a glob: CI builds set DEPLOYMENT_VERSION, so every
    // chunk URL ends in `?dpl=<sha>` and a `**/*.js` glob matches nothing.
    await page.route((url) => url.pathname.endsWith(".js"), async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      // MOBILE_MENU_ID: only the lazy mobile-menu chunk carries it
      // (__tests__/topbar-bundle.test.ts keeps it out of the main bundle).
      if (body.includes("site-mobile-menu")) {
        delayed += 1;
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        released = true;
      }
      await route.fulfill({ response, body });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const form = page.getByRole("search");
    // Wait until React has attached the form's handlers (hydrated).
    await form.evaluate(
      (el) =>
        new Promise<void>((resolve) => {
          const ready = () => Object.keys(el).some((key) => key.startsWith("__reactProps"));
          const tick = () => (ready() ? resolve() : requestAnimationFrame(tick));
          tick();
        }),
    );

    expect(delayed, "the mobile-menu chunk was intercepted").toBeGreaterThan(0);
    expect(released, "search ran while the chunk was still pending").toBe(false);

    await form.locator('input[type="search"]').fill("react hooks");
    await form.locator('input[type="search"]').press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/issues\?q=react%20hooks/);
  });
});

type Rgb = [number, number, number];

/**
 * Resolves CSS colors to opaque sRGB (0-255) by painting each on a 1x1 canvas
 * in the page. Computed styles come back as rgb(), lab(), oklch() or color()
 * depending on the source (Tailwind v4 uses oklch), so the browser does the
 * conversion instead of a regex. Unknown or translucent colors throw rather
 * than silently producing a wrong ratio.
 */
async function toRgb(page: Page, colors: string[]): Promise<Rgb[]> {
  return page.evaluate((list) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d canvas unavailable");
    return list.map((color) => {
      const sentinel = "#010203";
      ctx.fillStyle = sentinel;
      ctx.fillStyle = color;
      if (ctx.fillStyle === sentinel && color.toLowerCase() !== sentinel) {
        throw new Error(`unparseable color: ${color}`);
      }
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      if (a !== 255) throw new Error(`translucent color, contrast undefined: ${color}`);
      return [r, g, b] as [number, number, number];
    });
  }, colors);
}

/** WCAG 2 contrast ratio between two opaque sRGB colors. */
function contrastRatio(foreground: Rgb, background: Rgb) {
  const luminance = ([r, g, b]: Rgb) => {
    const [lr, lg, lb] = [r, g, b].map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Every color function inside a computed background-image, in order. */
const colorTokens = (value: string) =>
  value.match(/(?:rgba?|hsla?|lab|lch|oklab|oklch|color)\([^()]*\)/g) ?? [];

test.describe("Contrast helper (guards against a vacuous pass)", () => {
  test("converts modern color formats and flags a known failing pair", async ({ page }) => {
    await page.setContent("<!doctype html><title>contrast</title>");
    const [white, labWhite, cyan500, oklchCyan] = await toRgb(page, [
      "white",
      "lab(100 0 0)",
      "rgb(6, 182, 212)",
      "oklch(71.5% 0.143 215.221)", // Tailwind v4 cyan-500
    ]);
    expect(white).toEqual([255, 255, 255]);
    expect(labWhite).toEqual([255, 255, 255]);
    // White on cyan-500 is the pair that failed Lighthouse (2.42:1); the
    // helper must reproduce that and reject it, whatever format it arrives in.
    for (const cyan of [cyan500, oklchCyan]) {
      const ratio = contrastRatio(white, cyan);
      expect(ratio).toBeGreaterThan(2.2);
      expect(ratio).toBeLessThan(2.7);
      expect(ratio).toBeLessThan(4.5);
    }
    await expect(toRgb(page, ["not-a-color"])).rejects.toThrow(/unparseable/);
    await expect(toRgb(page, ["rgb(0 0 0 / 0.5)"])).rejects.toThrow(/translucent/);
  });
});

test.describe("Landing contrast", () => {
  test("sign-in CTAs meet WCAG AA at rest and on hover", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const links = page.locator('a[href="/login"]');
    await expect(links).toHaveCount(2); // topbar "Sign in" + hero "Sign in to get help"

    for (const link of await links.all()) {
      const ratio = async () => {
        const style = await link.evaluate((el) => {
          const computed = getComputedStyle(el);
          return { color: computed.color, background: computed.backgroundColor };
        });
        const [color, background] = await toRgb(page, [style.color, style.background]);
        return contrastRatio(color, background);
      };
      expect(await ratio()).toBeGreaterThanOrEqual(4.5);
      await link.hover();
      await expect.poll(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe("Topbar logo", () => {
  for (const viewport of [
    { name: "phone", width: 360, height: 780 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`home link is named and the logo is undistorted and small (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      const home = page.locator("header").getByRole("link", { name: "Hablu Support Library home" });
      await expect(home).toBeVisible();

      const logo = home.locator("img");
      await expect(logo).toHaveAttribute("alt", "");
      await expect(logo).toHaveAttribute("loading", "eager");
      await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

      const shape = await logo.evaluate((el: HTMLImageElement) => {
        const box = el.getBoundingClientRect();
        return { rendered: box.width / box.height, natural: el.naturalWidth / el.naturalHeight, fit: getComputedStyle(el).objectFit };
      });
      // object-contain keeps the drawn image at its natural ratio; the box
      // itself must also be within 2% of it.
      expect(shape.fit).toBe("contain");
      expect(Math.abs(shape.rendered - shape.natural) / shape.natural).toBeLessThan(0.02);
    });
  }

  test("logo is served resized, not the 63 KiB original", async ({ page, baseURL }) => {
    // Local Windows standalone builds (playwright.12001 on win32) ship sharp's
    // .node file without the libvips DLLs, so the optimizer silently falls back
    // to the original image. Production (Linux) resizes correctly: w=48 is a
    // ~1 KiB webp. The size check runs everywhere else.
    test.skip(
      process.platform === "win32" && Boolean(baseURL?.includes(":12001")),
      "local win32 standalone has no libvips DLLs; image optimizer falls back to the original",
    );
    const logoBytes: number[] = [];
    page.on("response", async (response) => {
      if (response.url().includes("logo.png")) {
        logoBytes.push((await response.body().catch(() => Buffer.alloc(0))).length);
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(logoBytes.length).toBeGreaterThan(0);
    expect(Math.max(...logoBytes)).toBeLessThan(15 * 1024);
  });
});

test.describe("Landing search button contrast", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("Search button text meets WCAG AA across the whole gradient, at rest and on hover", async ({
    page,
  }) => {
    await page.goto("/");
    const button = page.getByRole("search").getByRole("button", { name: "Search" });
    const style = await button.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { color: computed.color, image: computed.backgroundImage };
    });

    // brand-bg is a two-stop linear gradient; sample both ends and the middle
    // (legacy-color gradients interpolate in sRGB).
    const tokens = colorTokens(style.image);
    expect(tokens, style.image).toHaveLength(2);
    const [text, from, to] = await toRgb(page, [style.color, ...tokens]);
    const samples = [0, 0.5, 1].map(
      (t) => from.map((channel, i) => Math.round(channel + (to[i] - channel) * t)) as Rgb,
    );
    // hover:brightness-110 multiplies each channel by 1.1 (clamped).
    const hovered = samples.map((rgb) => rgb.map((channel) => Math.min(255, Math.round(channel * 1.1))) as Rgb);

    for (const background of [...samples, ...hovered]) {
      expect(contrastRatio(text, background), `text ${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe("Landing motion", () => {
  test("reduced motion shows the hero immediately with no animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    const cta = page.locator("main").getByRole("link", { name: "Sign in to get help" });
    await expect(cta).toBeVisible();
    expect(await cta.evaluate((el) => getComputedStyle(el.parentElement!).opacity)).toBe("1");
  });

  test("headline is never hidden while it animates (LCP)", async ({ page }) => {
    await page.goto("/");
    const opacity = await page
      .getByRole("heading", { level: 1 })
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});

test.describe("Landing library search", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("search button deep-links to the issues query", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("search").locator('input[type="search"]');
    await input.fill("react hooks");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/issues\?q=react%20hooks/);
    await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();
  });
});

test.describe("Landing AI access hint", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("points students at the dashboard instead of a second request form", async ({ page }) => {
    await page.goto("/");

    // The landing page never carries the access-request form: it only links to
    // the one place that owns it, so there is a single write path.
    await expect(page.getByRole("checkbox", { name: /n8n access/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Help & access/ })).toHaveAttribute(
      "href",
      "/dashboard/issues",
    );

    // Creating a request lives in the navigation only — the hero must not
    // duplicate it as a second primary call to action.
    await expect(page.getByRole("link", { name: "Create an issue" })).toHaveCount(0);
    await expect(
      page.locator('header nav[aria-label="Primary"]').getByRole("link", { name: "Create issue" }),
    ).toBeVisible();
  });
});
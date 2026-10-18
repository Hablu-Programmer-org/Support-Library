// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as LinksModule from "@/lib/links";

const original = process.env.NEXT_PUBLIC_LMS_URL;

/** `lib/links` reads the environment at import time, so reload it per case. */
async function loadLinks(value?: string): Promise<typeof LinksModule> {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_LMS_URL;
  } else {
    process.env.NEXT_PUBLIC_LMS_URL = value;
  }

  return import("@/lib/links");
}

afterEach(() => {
  if (original === undefined) {
    delete process.env.NEXT_PUBLIC_LMS_URL;
  } else {
    process.env.NEXT_PUBLIC_LMS_URL = original;
  }
  vi.resetModules();
});

describe("lms link", () => {
  it("is absent when the LMS origin is not configured", async () => {
    const links = await loadLinks();

    expect(links.hasLmsLink).toBe(false);
    expect(links.lmsHref("/dashboard/my-courses")).toBeNull();
  });

  it("builds an absolute url and drops a trailing slash", async () => {
    const links = await loadLinks("https://www.hablu-programmer.com/");

    expect(links.lmsHref("/dashboard/my-courses")).toBe(
      "https://www.hablu-programmer.com/dashboard/my-courses",
    );
  });

  it("keeps a sub-path prefix and tolerates a missing leading slash", async () => {
    const links = await loadLinks("https://example.com/lms");

    expect(links.lmsHref("dashboard/my-courses")).toBe(
      "https://example.com/lms/dashboard/my-courses",
    );
  });

  it("ignores a value that is not an http(s) origin", async () => {
    const links = await loadLinks("javascript:alert(1)");

    expect(links.hasLmsLink).toBe(false);
    expect(links.lmsHref("/dashboard/my-courses")).toBeNull();
  });

  it("ignores an unparseable value", async () => {
    const links = await loadLinks("not a url");

    expect(links.hasLmsLink).toBe(false);
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard/issues" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));

import { MobileMenu } from "@/components/layout/mobile-menu";
import type { NavItem } from "@/lib/config/nav";

const Icon = () => null;
const items: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", exact: true, icon: Icon },
  { label: "Issues", href: "/dashboard/issues", icon: Icon },
  { label: "My Courses", href: "https://lms.example.com/dashboard/my-courses", external: true, icon: Icon },
];

const openButton = () => screen.getByRole("button", { name: "Open menu" });
const mobileNav = () => screen.queryByRole("navigation", { name: "Mobile" });

describe("MobileMenu", () => {
  beforeEach(() => {
    navigation.pathname = "/dashboard/issues";
  });

  it("starts closed and opens a Mobile nav with every link", () => {
    render(<MobileMenu items={items} />);

    expect(openButton().getAttribute("aria-expanded")).toBe("false");
    expect(mobileNav()).toBeNull();

    fireEvent.click(openButton());

    const nav = mobileNav();
    expect(nav).not.toBeNull();
    const links = within(nav!).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Dashboard", "Issues", "My Courses"]);
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close.getAttribute("aria-expanded")).toBe("true");
    expect(close.getAttribute("aria-controls")).toBe("site-mobile-menu");
  });

  it("renders the panel into document.body, outside the trigger's tree", () => {
    const { container } = render(<MobileMenu items={items} />);
    fireEvent.click(openButton());

    const panel = document.getElementById("site-mobile-menu");
    expect(panel).not.toBeNull();
    expect(panel?.parentElement).toBe(document.body);
    expect(container.contains(panel)).toBe(false);
  });

  it("marks only the active in-app link and keeps the external one inert", () => {
    render(<MobileMenu items={items} />);
    fireEvent.click(openButton());

    const nav = mobileNav()!;
    expect(within(nav).getByRole("link", { name: "Issues" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();

    const external = within(nav).getByRole("link", { name: "My Courses" });
    expect(external.getAttribute("aria-current")).toBeNull();
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toContain("noopener");
  });

  it("closes on Escape, returns focus to the trigger and unlocks scrolling", async () => {
    render(<MobileMenu items={items} />);
    fireEvent.click(openButton());
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(mobileNav()).toBeNull());
    expect(document.activeElement).toBe(openButton());
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when a link is chosen", async () => {
    render(<MobileMenu items={items} />);
    fireEvent.click(openButton());

    fireEvent.click(within(mobileNav()!).getByRole("link", { name: "Dashboard" }));

    await waitFor(() => expect(mobileNav()).toBeNull());
  });

  it("closes when the route changes underneath it", async () => {
    const { rerender } = render(<MobileMenu items={items} />);
    fireEvent.click(openButton());

    navigation.pathname = "/dashboard";
    rerender(<MobileMenu items={items} />);

    await waitFor(() => expect(mobileNav()).toBeNull());
  });

  it("offers the theme toggle under Appearance", () => {
    render(<MobileMenu items={items} />);
    fireEvent.click(openButton());

    expect(screen.queryByText("Appearance")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Light mode" })).not.toBeNull();
  });
});

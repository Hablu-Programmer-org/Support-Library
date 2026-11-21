import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { signOut } from "next-auth/react";

import { UserMenu, initialsFor } from "@/components/auth/user-menu";

const admin = {
  name: "Rahim Uddin",
  email: "rahim@example.com",
  role: "ADMIN" as const,
};

const trigger = () => screen.getByRole("button", { name: "Profile menu" });
const signOutButton = () => screen.queryByRole("button", { name: "Sign out" });

describe("initialsFor", () => {
  it("takes the first letters of up to two name parts", () => {
    expect(initialsFor({ name: "Rahim Uddin Khan" })).toBe("RU");
    expect(initialsFor({ name: "rahim" })).toBe("R");
  });

  it("falls back to the email, then to U", () => {
    expect(initialsFor({ name: null, email: "x@example.com" })).toBe("X");
    expect(initialsFor({})).toBe("U");
  });
});

describe("UserMenu", () => {
  beforeEach(() => {
    vi.mocked(signOut).mockClear();
  });

  it("starts closed and opens with identity, role and sign out", () => {
    render(<UserMenu user={admin} />);

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(signOutButton()).toBeNull();

    fireEvent.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const panelId = trigger().getAttribute("aria-controls");
    const panel = document.getElementById(panelId ?? "");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("Rahim Uddin");
    expect(panel?.textContent).toContain("rahim@example.com");
    expect(panel?.textContent).toContain("Admin");
    expect(signOutButton()).not.toBeNull();
  });

  it("toggles closed on a second trigger click", () => {
    render(<UserMenu user={admin} />);

    fireEvent.click(trigger());
    fireEvent.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(signOutButton()).toBeNull();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<UserMenu user={admin} />);

    fireEvent.click(trigger());
    signOutButton()?.focus();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(signOutButton()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on a pointer down outside, but not inside the panel", () => {
    render(
      <>
        <UserMenu user={admin} />
        <p>Outside</p>
      </>,
    );

    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("rahim@example.com"));
    expect(signOutButton()).not.toBeNull();

    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(signOutButton()).toBeNull();
  });

  it("signs out to the login page from the panel", () => {
    render(<UserMenu user={admin} />);

    fireEvent.click(trigger());
    fireEvent.click(signOutButton()!);

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("shows initials without an image and Student when the role is missing", () => {
    render(<UserMenu user={{ name: null, email: "kamal@example.com" }} />);

    expect(trigger().textContent).toContain("K");
    fireEvent.click(trigger());
    expect(screen.queryByText("Unnamed user")).not.toBeNull();
    expect(screen.queryByText("Student")).not.toBeNull();
  });

  it("never uses the mobile menu's name or chunk marker", () => {
    // The landing E2E delays the chunk containing "site-mobile-menu"; this menu
    // ships in the main chunk, so its markup must not carry that marker.
    const { container } = render(<UserMenu user={admin} />);
    fireEvent.click(trigger());

    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    expect(container.innerHTML).not.toContain("site-mobile-menu");
  });
});

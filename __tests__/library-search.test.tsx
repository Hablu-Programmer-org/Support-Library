/**
 * Landing search contract: the redesign changed only the look. Submitting
 * trims, ignores empty input, and always URL-encodes the query.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

import { LibrarySearch } from "@/components/landing/library-search";

const input = () => screen.getByLabelText("Search published answers") as HTMLInputElement;

function search(term: string) {
  fireEvent.change(input(), { target: { value: term } });
  fireEvent.submit(screen.getByRole("search"));
}

describe("LibrarySearch", () => {
  beforeEach(() => {
    push.mockReset();
    render(<LibrarySearch />);
  });

  it("keeps an accessible label, search role and a submit button", () => {
    expect(input().getAttribute("type")).toBe("search");
    expect(screen.getByRole("button", { name: "Search" }).getAttribute("type")).toBe("submit");
  });

  it("navigates to the issues list with the trimmed query", () => {
    search("  react hooks  ");
    expect(push).toHaveBeenCalledExactlyOnceWith("/dashboard/issues?q=react%20hooks");
  });

  it.each(["", "   ", "\t\n"])("does not navigate for empty input %j", (term) => {
    search(term);
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["<script>alert(1)</script>", "%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
    ["a&q=admin&role=ADMIN", "a%26q%3Dadmin%26role%3DADMIN"],
    ["../../api/health#x", "..%2F..%2Fapi%2Fhealth%23x"],
    ["এরর কেন আসছে?", encodeURIComponent("এরর কেন আসছে?")],
  ])("encodes %j so it cannot change the route or add params", (term, encoded) => {
    search(term);
    expect(push).toHaveBeenCalledExactlyOnceWith(`/dashboard/issues?q=${encoded}`);
    const url = new URL(push.mock.calls[0][0], "http://local");
    expect(url.pathname).toBe("/dashboard/issues");
    expect([...url.searchParams.keys()]).toEqual(["q"]);
    expect(url.searchParams.get("q")).toBe(term);
  });
});

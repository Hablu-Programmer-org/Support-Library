/**
 * The search field's contract with the URL.
 *
 * - typing debounces, deletion/clearing is immediate,
 * - a server echo of our own navigation never overwrites the draft,
 * - external navigation (Reset, back/forward) replaces the draft,
 * - IME composition never navigates mid-word,
 * - one character shows a hint and keeps the current results.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}));

import { IssueSearchField } from "@/components/issues/issue-search-field";
import { DEFAULT_ISSUE_FILTERS, type IssueFilterDefaults } from "@/lib/issue-list-params";

const defaults = (overrides: Partial<IssueFilterDefaults> = {}): IssueFilterDefaults => ({
  ...DEFAULT_ISSUE_FILTERS,
  ...overrides,
});

const renderField = (overrides: Partial<IssueFilterDefaults> = {}) =>
  render(
    <IssueSearchField
      defaults={defaults(overrides)}
      defaultSort="relevance"
      open={false}
      onToggle={() => {}}
    />,
  );

const input = () => screen.getByLabelText("Search issues") as HTMLInputElement;

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("IssueSearchField", () => {
  it("debounces typing and then navigates", async () => {
    renderField();

    fireEvent.change(input(), { target: { value: "im" } });
    await tick(0);
    expect(replace).not.toHaveBeenCalled();

    await tick(200);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toContain("q=im");
  });

  it("navigates immediately when a character is deleted", async () => {
    renderField({ q: "image" });

    fireEvent.change(input(), { target: { value: "imag" } });
    await tick(0);
    // No 200 ms wait: deletion feels instant.
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toContain("q=imag");
  });

  it("clears immediately with the explicit clear button", async () => {
    renderField({ q: "image" });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await tick(0);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).not.toContain("q=");
    expect(input().value).toBe("");
  });

  it("clears on Escape", async () => {
    renderField({ q: "image" });

    fireEvent.keyDown(input(), { key: "Escape" });
    await tick(0);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).not.toContain("q=");
  });

  it("flushes the pending value on Enter without waiting for the debounce", async () => {
    renderField();

    fireEvent.change(input(), { target: { value: "hydration" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toContain("q=hydration");
  });

  it("keeps the current results for a single character and shows a hint", async () => {
    renderField();

    fireEvent.change(input(), { target: { value: "a" } });
    await tick(1_000);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Type at least 2 characters to search.")).not.toBeNull();
  });

  it("never navigates during IME composition, then applies on composition end", async () => {
    renderField();

    fireEvent.compositionStart(input());
    fireEvent.change(input(), { target: { value: "ছবি" } });
    await tick(1_000);
    expect(replace).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input());
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toContain("q=%E0%A6%9B%E0%A6%AC%E0%A6%BF");
  });

  it("ignores the echo of its own navigation", async () => {
    const view = renderField();

    fireEvent.change(input(), { target: { value: "im" } });
    await tick(200);
    expect(replace).toHaveBeenCalledTimes(1);

    // The server render comes back with the same value: the draft is untouched.
    view.rerender(
      <IssueSearchField
        defaults={defaults({ q: "im" })}
        defaultSort="relevance"
        open={false}
        onToggle={() => {}}
      />,
    );
    expect(input().value).toBe("im");
  });

  it("adopts an external navigation such as Reset or back/forward", () => {
    const view = renderField({ q: "image" });
    expect(input().value).toBe("image");

    view.rerender(
      <IssueSearchField
        defaults={defaults({ q: "" })}
        defaultSort="answer"
        open={false}
        onToggle={() => {}}
      />,
    );
    expect(input().value).toBe("");
  });

  it("keeps every other filter when a search is applied", async () => {
    renderField({ status: "OPEN", courseSlug: "react-beginner" });

    fireEvent.change(input(), { target: { value: "image" } });
    await tick(200);

    expect(replace).toHaveBeenCalledTimes(1);
    const href = replace.mock.calls[0]?.[0] ?? "";
    expect(href).toContain("q=image");
    expect(href).toContain("status=OPEN");
    expect(href).toContain("courseSlug=react-beginner");
  });
});

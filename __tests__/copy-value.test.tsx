import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyValue } from "@/components/shared/copy-value";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  // @ts-expect-error test cleanup
  delete navigator.clipboard;
});

describe("CopyValue", () => {
  it("copies on double-click", () => {
    render(<CopyValue label="request reference" value="274819" />);

    fireEvent.doubleClick(screen.getByText("274819"));

    expect(writeText).toHaveBeenCalledWith("274819");
  });

  it("copies from the button beside the value", () => {
    render(<CopyValue label="student email" value="student@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy student email" }));

    expect(writeText).toHaveBeenCalledWith("student@example.com");
  });

  it("keeps the value visible and selectable", () => {
    render(<CopyValue label="request reference" value="274819" variant="chip" />);

    const value = screen.getByText("274819");
    expect(value.className).toContain("select-all");
  });
});

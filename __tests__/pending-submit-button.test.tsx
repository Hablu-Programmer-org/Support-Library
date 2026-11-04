import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

describe("PendingSubmitButton", () => {
  it("fills the available width by default", () => {
    render(<PendingSubmitButton label="Send reply" pendingLabel="Sending…" />);

    const button = screen.getByRole("button", { name: "Send reply" });
    expect(button.className).toContain("w-full");
    expect(button.className).not.toContain("w-auto");
  });

  it("stays content-sized when fullWidth is false", () => {
    render(
      <PendingSubmitButton
        fullWidth={false}
        label="Send email"
        pendingLabel="Sending…"
      />,
    );

    const button = screen.getByRole("button", { name: "Send email" });
    expect(button.className).toContain("w-auto");
    expect(button.className).toContain("shrink-0");
    expect(button.className).not.toContain("w-full");
  });
});

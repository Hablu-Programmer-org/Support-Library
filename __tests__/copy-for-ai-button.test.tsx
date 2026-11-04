import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyForAiButton } from "@/components/issues/copy-for-ai-button";

const PROMPT = "# Support Issue Response Request\n\n<ISSUE_DATA>\nTitle: Webhook\n</ISSUE_DATA>";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  // @ts-expect-error test cleanup
  delete navigator.clipboard;
});

describe("CopyForAiButton", () => {
  it("copies the exact server-built prompt", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyForAiButton prompt={PROMPT} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PROMPT));
    expect(await screen.findByText("Copied for AI")).not.toBeNull();
  });

  it("announces the copy to screen readers and keeps the button labelled", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyForAiButton prompt={PROMPT} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));

    await waitFor(() =>
      expect(screen.getByText(/Issue context copied/)).not.toBeNull(),
    );
    // The accessible name stays stable after the visual label changes.
    expect(screen.getByRole("button", { name: "Copy for AI" })).not.toBeNull();
  });

  it("offers the prompt for a manual copy when the clipboard is denied", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CopyForAiButton prompt={PROMPT} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not copy automatically");

    const fallback = screen.getByRole("textbox", {
      name: "AI prompt to copy manually",
    }) as HTMLTextAreaElement;
    expect(fallback.value).toBe(PROMPT);
    expect(fallback.readOnly).toBe(true);
  });
});

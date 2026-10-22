import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttachmentList } from "@/components/shared/attachment-list";

const upload = {
  id: "66f1a2b3c4d5e6f7a8b9c0d1",
  originalName: "screenshot.png",
  mimeType: "image/png",
  byteSize: 2048,
  width: 800,
  height: 600,
};

describe("AttachmentList", () => {
  it("opens a preview dialog instead of navigating away", () => {
    render(<AttachmentList uploads={[upload]} />);

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview screenshot.png" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("screenshot.png");
    // The full image and the explicit "open original" escape hatch live inside it.
    expect(dialog.querySelectorAll('img[alt="screenshot.png"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open original" }).getAttribute("href")).toBe(
      "/api/attachments/66f1a2b3c4d5e6f7a8b9c0d1",
    );
  });

  it("closes on Escape and on the backdrop", () => {
    render(<AttachmentList uploads={[upload]} />);

    fireEvent.click(screen.getByRole("button", { name: "Preview screenshot.png" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview screenshot.png" }));
    // The backdrop is the first "Close preview" control (the button in the header
    // is the second one).
    fireEvent.click(screen.getAllByRole("button", { name: "Close preview" })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders nothing without uploads", () => {
    const { container } = render(<AttachmentList uploads={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

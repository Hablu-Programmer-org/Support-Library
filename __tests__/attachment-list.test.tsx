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

  it("sizes the frame from the stored image size instead of a fixed half-row box", () => {
    const { container } = render(<AttachmentList uploads={[upload]} />);
    const img = container.querySelector("ul img");
    expect(img?.getAttribute("width")).toBe("800");
    expect(img?.getAttribute("height")).toBe("600");
    expect(img?.classList.contains("w-auto")).toBe(true);
    expect(img?.classList.contains("w-full")).toBe(false);
    // A definite height (not h-auto) so the frame is reserved before lazy load.
    expect(img?.classList.contains("h-auto")).toBe(false);
    expect((img as HTMLImageElement).style.height).toBe("192px");
    expect(container.querySelector("ul")?.className).not.toContain("grid-cols-2");
  });

  it("does not blow a small image up past its own height", () => {
    const { container } = render(<AttachmentList uploads={[{ ...upload, width: 120, height: 60 }]} />);
    expect((container.querySelector("ul img") as HTMLImageElement).style.height).toBe("60px");
  });

  it("falls back to a fixed-height frame when the size is unknown or invalid", () => {
    for (const size of [{ width: null, height: null }, { width: 0, height: 600 }, { width: -5, height: 10 }]) {
      const { container, unmount } = render(<AttachmentList uploads={[{ ...upload, ...size }]} />);
      const img = container.querySelector("ul img");
      expect(img?.hasAttribute("width")).toBe(false);
      expect(img?.className).toContain("h-48");
      unmount();
    }
  });

  it("renders nothing without uploads", () => {
    const { container } = render(<AttachmentList uploads={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

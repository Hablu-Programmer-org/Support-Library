import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentField } from "@/components/shared/attachment-field";

const png = (name: string, size = 1024) => new File([new Uint8Array(size)], name, { type: "image/png" });

let created = 0;
const revoke = vi.fn();

beforeEach(() => {
  created = 0;
  revoke.mockClear();
  // jsdom has no blob URLs.
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:preview-${++created}`),
    revokeObjectURL: revoke,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const input = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;

function pick(container: HTMLElement, files: File[]) {
  const field = input(container);
  Object.defineProperty(field, "files", { value: files, configurable: true });
  fireEvent.change(field);
}

describe("AttachmentField dropzone", () => {
  it("keeps the real file input in the form, labelled, but visually hidden", () => {
    const { container } = render(<AttachmentField label="Attachments" />);
    const field = input(container);
    expect(field.name).toBe("uploads");
    expect(field.multiple).toBe(true);
    expect(field.accept).toContain("image/png");
    expect(field.className).toContain("sr-only");
    expect(screen.getByLabelText("Attachments")).toBe(field);
  });

  it("is a keyboard-reachable zone that opens the picker on Enter and Space", () => {
    const { container } = render(<AttachmentField label="Attachments" />);
    const click = vi.spyOn(input(container), "click").mockImplementation(() => {});
    const zone = screen.getByRole("button", { name: "Add attachments" });
    expect(zone.tabIndex).toBe(0);
    fireEvent.keyDown(zone, { key: "Enter" });
    fireEvent.keyDown(zone, { key: " " });
    fireEvent.click(zone);
    expect(click).toHaveBeenCalledTimes(3);
  });

  it("shows thumbnails with a count after picking, and removes one", () => {
    const { container } = render(<AttachmentField label="Attachments" />);
    pick(container, [png("a.png"), png("b.png"), png("c.png")]);

    expect(screen.getByText(/3 of 5/)).toBeTruthy();
    expect(screen.getAllByRole("img").map((img) => img.getAttribute("alt"))).toEqual([
      "Preview of a.png",
      "Preview of b.png",
      "Preview of c.png",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove b.png" }));
    expect(screen.getByText(/2 of 5/)).toBeTruthy();
    expect(screen.queryByAltText("Preview of b.png")).toBeNull();
    // The removed preview's blob URL is released.
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("adds a second pick to the first instead of replacing it", () => {
    const { container } = render(<AttachmentField label="Attachments" />);
    pick(container, [png("first.png")]);
    pick(container, [png("second.png")]);
    expect(screen.getByText(/2 of 5/)).toBeTruthy();
  });

  it("caps the selection at the limit and says so", () => {
    const { container } = render(<AttachmentField label="Attachments" />);
    pick(container, Array.from({ length: 7 }, (_, i) => png(`${i}.png`)));
    expect(screen.getAllByRole("img")).toHaveLength(5);
    expect(screen.getByRole("status").textContent).toBeTruthy();
  });

  it("disables the zone and the input when the item is already full", () => {
    const { container } = render(<AttachmentField label="Attachments" existingCount={5} />);
    expect(input(container).disabled).toBe(true);
    const zone = screen.getByRole("button", { name: "Attachment limit reached" });
    expect(zone.getAttribute("aria-disabled")).toBe("true");
    expect(zone.tabIndex).toBe(-1);
  });

  it("accepts images dropped on the page", () => {
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    render(<AttachmentField label="Attachments" />);

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: { types: ["Files"], files: [png("dropped.png")] },
    });
    act(() => {
      window.dispatchEvent(drop);
    });

    expect(drop.defaultPrevented).toBe(true);
    expect(screen.getByAltText("Preview of dropped.png")).toBeTruthy();
  });

  it("revokes every preview URL on unmount", () => {
    const { container, unmount } = render(<AttachmentField label="Attachments" />);
    pick(container, [png("a.png"), png("b.png")]);
    unmount();
    expect(revoke).toHaveBeenCalledTimes(2);
  });
});

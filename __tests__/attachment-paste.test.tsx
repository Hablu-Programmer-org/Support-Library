import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentField, clipboardFiles } from "@/components/shared/attachment-field";

beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});

const png = (name = "image.png") => new File([new Uint8Array(8)], name, { type: "image/png", lastModified: 1 });

/** Two forms, like an issue page: the reply composer and a reply being edited. */
function Page() {
  return (
    <>
      <form data-testid="composer">
        <input aria-label="Composer title" />
        <textarea aria-label="Composer notes" />
        <section>
          <AttachmentField name="uploads" label="Composer images" />
        </section>
      </form>
      <form data-testid="edit">
        <input aria-label="Edit title" />
        <section>
          <AttachmentField name="editUploads" label="Edit images" />
        </section>
      </form>
      <form data-testid="search">
        <input aria-label="Search" />
      </form>
    </>
  );
}

/** jsdom has no ClipboardEvent constructor with data, so build one. */
function paste(files: File[], text = "") {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { files, items: [], getData: (type: string) => (type === "text/plain" ? text : "") },
  });
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(event);
  });
  return event;
}

/** Previews rendered inside the section that holds the named file input. */
const count = (container: HTMLElement, name: string) =>
  container.querySelector(`input[name="${name}"]`)!.closest("section")!.querySelectorAll("img").length;

const focus = (container: HTMLElement, label: string) =>
  act(() => {
    (container.querySelector(`[aria-label="${label}"]`) as HTMLElement).focus();
  });

describe("paste an image to attach it", () => {
  it("attaches to the field in the form that has focus", () => {
    const { container } = render(<Page />);
    focus(container, "Edit title");

    const event = paste([png()]);

    expect(event.defaultPrevented).toBe(true);
    expect(count(container, "editUploads")).toBe(1);
    expect(count(container, "uploads")).toBe(0);
  });

  it("uses the last clicked form when focus is on the page itself", () => {
    const { getByTestId, container } = render(<Page />);
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      getByTestId("composer").dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    paste([png()]);

    expect(count(container, "uploads")).toBe(1);
    expect(count(container, "editUploads")).toBe(0);
  });

  it("leaves a text-and-image paste in a text field alone (Word, Sheets)", () => {
    const { container } = render(<Page />);
    focus(container, "Composer notes");

    const event = paste([png()], "Quarterly numbers");

    expect(event.defaultPrevented).toBe(false);
    expect(count(container, "uploads")).toBe(0);
  });

  it("does nothing for a text-only paste", () => {
    const { container } = render(<Page />);
    focus(container, "Composer title");

    const event = paste([], "hello");

    expect(event.defaultPrevented).toBe(false);
    expect(count(container, "uploads")).toBe(0);
  });

  it("does nothing in a form without an attachment field", () => {
    const { container } = render(<Page />);
    focus(container, "Search");

    const event = paste([png()]);

    expect(event.defaultPrevented).toBe(false);
    expect(count(container, "uploads")).toBe(0);
    expect(count(container, "editUploads")).toBe(0);
  });

  it("skips a paste the editor already handled", () => {
    const { container } = render(<Page />);
    focus(container, "Composer title");
    const handled = (event: Event) => event.preventDefault();
    document.addEventListener("paste", handled, true);

    paste([png()]);

    document.removeEventListener("paste", handled, true);
    expect(count(container, "uploads")).toBe(0);
  });
});

describe("clipboardFiles", () => {
  it("reads `items` when `files` is empty", () => {
    const file = png("from-items.png");
    const data = {
      files: [],
      items: [
        { kind: "string", getAsFile: () => null },
        { kind: "file", getAsFile: () => file },
      ],
    } as unknown as DataTransfer;
    expect(clipboardFiles(data)).toEqual([file]);
  });

  it("returns nothing without clipboard data", () => {
    expect(clipboardFiles(null)).toEqual([]);
  });
});

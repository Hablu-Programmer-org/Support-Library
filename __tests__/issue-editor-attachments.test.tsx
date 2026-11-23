import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { createStudentIssueAction } = vi.hoisted(() => ({
  createStudentIssueAction: vi.fn(async () => ({ fieldErrors: {} })),
}));
vi.mock("@/actions/issues", () => ({ createStudentIssueAction }));

import { describeAttach } from "@/components/issues/issue-editor-client";
import { StudentIssueForm } from "@/components/issues/student-issue-form";

import { editorOf, findIssueTextbox, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);

let created = 0;
beforeEach(() => {
  created = 0;
  // jsdom has no blob URLs.
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:preview-${++created}`),
    revokeObjectURL: vi.fn(),
  });
});

const png = (name: string, lastModified = 1) =>
  new File([new Uint8Array(64)], name, { type: "image/png", lastModified });

const shots = (count: number) => Array.from({ length: count }, (_, index) => png(`shot-${index + 1}.png`, index + 1));

/** jsdom has no DataTransfer; ProseMirror only reads getData(), files and types. */
function transfer(files: File[], text = "") {
  return {
    files,
    types: [...(files.length ? ["Files"] : []), ...(text ? ["text/plain"] : [])],
    items: [],
    getData: (type: string) => (type === "text/plain" ? text : ""),
    dropEffect: "none",
  };
}

function paste(target: HTMLElement, files: File[], text = "") {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: transfer(files, text) });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function drop(target: HTMLElement, files: File[]) {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer(files) });
  Object.assign(event, { clientX: 10, clientY: 10 });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

async function setup() {
  const view = render(<StudentIssueForm courses={[]} csrfToken="csrf-1" />);
  const box = await findIssueTextbox();
  return { ...view, box, editor: editorOf(box) };
}

const previews = () => screen.queryAllByRole("img", { name: /^Preview of / });
const notice = () => document.querySelector("[data-issue-editor-attach-notice]");
const markdown = (container: HTMLElement) =>
  (container.querySelector('input[type="hidden"][name="question"]') as HTMLInputElement).value;

describe("screenshots pasted or dropped on the issue editor", () => {
  it("sends a pasted screenshot to Screenshots, not into the text (spec example)", async () => {
    const { box, container } = await setup();
    const event = paste(box, [png("screenshot.png")]);

    expect(event.defaultPrevented).toBe(true);
    expect(previews().map((img) => img.getAttribute("alt"))).toEqual(["Preview of screenshot.png"]);
    expect(notice()?.textContent).toContain("1 screenshot added to Screenshots below.");
    expect(box.querySelector("img")).toBeNull();
    expect(markdown(container)).toBe("");
    // The real file input carries it, so the existing upload path submits it.
    const input = container.querySelector('input[type="file"][name="uploads"]') as HTMLInputElement;
    expect(input).not.toBeNull();
  });

  it("adds the first five of six screenshots and says why one was left out (spec bad situation)", async () => {
    const { box } = await setup();
    paste(box, shots(6));

    expect(previews()).toHaveLength(5);
    expect(notice()?.textContent).toMatch(/5 screenshots added to Screenshots below\. Only 5 images can be attached; 1 file was not added\./);
  });

  it("explains a full field without adding anything", async () => {
    const { box } = await setup();
    paste(box, shots(5));
    paste(box, [png("one-more.png", 99)]);

    expect(previews()).toHaveLength(5);
    expect(notice()?.textContent).toMatch(/Only 5 images can be attached/);
    expect(notice()?.textContent).not.toMatch(/added to Screenshots/);
  });

  it("pastes the text when the clipboard also has an image of it (Word, Sheets)", async () => {
    const { box, container } = await setup();
    paste(box, [png("word-selection.png")], "Text copied from Word");

    expect(previews()).toHaveLength(0);
    expect(notice()).toBeNull();
    expect(markdown(container)).toBe("Text copied from Word");
  });

  it("attaches files dropped on the editor exactly once", async () => {
    const { box } = await setup();
    const windowDrop = vi.fn();
    window.addEventListener("drop", windowDrop);
    const event = drop(box, [png("dragged.png")]);
    window.removeEventListener("drop", windowDrop);

    expect(event.defaultPrevented).toBe(true);
    expect(windowDrop).not.toHaveBeenCalled();
    expect(previews().map((img) => img.getAttribute("alt"))).toEqual(["Preview of dragged.png"]);
    expect(notice()?.textContent).toContain("1 screenshot added");
  });

  it("clears the notice on the next edit and can bring the field into view", async () => {
    const { box, editor } = await setup();
    paste(box, [png("screenshot.png")]);
    const scrollIntoView = vi.fn();
    const field = document.querySelector<HTMLElement>("[data-attachment-drop]")!;
    field.scrollIntoView = scrollIntoView;

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement).toBe(field.querySelector('[role="button"]')));

    act(() => {
      editor.commands.insertContent("typing again");
    });
    expect(notice()).toBeNull();
  });
});

describe("describeAttach", () => {
  it("words each outcome", () => {
    const container = document.createElement("div");
    expect(describeAttach({ added: 1, note: null, container }).message).toBe("1 screenshot added to Screenshots below.");
    expect(describeAttach({ added: 2, note: null, container }).message).toBe("2 screenshots added to Screenshots below.");
    expect(describeAttach({ added: 0, note: "1 file skipped: already selected.", container }).message).toBe(
      "1 file skipped: already selected.",
    );
    expect(describeAttach(null)).toEqual({ message: "Add screenshots in the Screenshots section.", container: null });
  });
});

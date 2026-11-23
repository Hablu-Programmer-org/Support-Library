import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { createStudentIssueAction } = vi.hoisted(() => ({
  createStudentIssueAction: vi.fn(async (...args: [unknown, FormData]) => {
    void args;
    return { fieldErrors: {} as Record<string, string[]> };
  }),
}));
vi.mock("@/actions/issues", () => ({ createStudentIssueAction }));

import { StudentIssueForm } from "@/components/issues/student-issue-form";
import { issueDraftKey, writeIssueDraft } from "@/lib/issue-draft";

import { editorOf, findIssueTextbox, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);

const key = issueDraftKey("student-1");
const courses = [{ slug: "web", name: "Web Dev", batchNo: 3 }];
const saved = () => JSON.parse(window.localStorage.getItem(key) ?? "null");

beforeEach(() => {
  window.localStorage.clear();
  createStudentIssueAction.mockReset();
  createStudentIssueAction.mockImplementation(async () => ({ fieldErrors: {} }));
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});

const renderForm = () => render(<StudentIssueForm courses={courses} csrfToken="csrf" draftKey={key} />);
/** Restoring waits for the lazily loaded editor, which is slow under a full parallel run. */
const slow = { timeout: 4000 };

const input = (container: HTMLElement, name: string) =>
  container.querySelector(`[name="${name}"]`) as HTMLInputElement;

describe("StudentIssueForm draft", () => {
  it("restores a saved draft into every field and the editor, and says so", async () => {
    writeIssueDraft(key, {
      title: "Blank assignment page",
      question: "The page is **blank** after login.",
      courseSlug: "web",
      moduleSlug: "module-5",
      contentSlug: "",
      tags: "react",
    });
    const { container } = renderForm();
    const box = await findIssueTextbox();

    await waitFor(() => expect(input(container, "title").value).toBe("Blank assignment page"), slow);
    expect(box.querySelector("strong")?.textContent).toBe("blank");
    expect(input(container, "question").value).toBe("The page is **blank** after login.");
    expect((container.querySelector('select[name="courseSlug"]') as HTMLSelectElement).value).toBe("web");
    expect(input(container, "moduleSlug").value).toBe("module-5");
    // Restored optional values are not hidden in a closed disclosure.
    expect(container.querySelector("details")?.open).toBe(true);
    expect(document.querySelector("[data-issue-draft-restored]")?.textContent).toMatch(
      /Restored your unsent draft from .+\. Screenshots are not kept in drafts\./,
    );
  });

  it("drops a saved course the student is no longer enrolled in", async () => {
    writeIssueDraft(key, { title: "Old course draft", question: "", courseSlug: "gone", moduleSlug: "", contentSlug: "", tags: "" });
    const { container } = renderForm();
    await findIssueTextbox();
    await waitFor(() => expect(input(container, "title").value).toBe("Old course draft"), slow);
    expect((container.querySelector('select[name="courseSlug"]') as HTMLSelectElement).value).toBe("");
  });

  it("autosaves shortly after typing, and never before the saved draft was checked", async () => {
    writeIssueDraft(key, { title: "Earlier draft", question: "", courseSlug: "", moduleSlug: "", contentSlug: "", tags: "" });
    const { container } = renderForm();
    const box = await findIssueTextbox();
    await waitFor(() => expect(input(container, "title").value).toBe("Earlier draft"), slow);
    expect(saved()?.title).toBe("Earlier draft");

    act(() => {
      editorOf(box).commands.insertContent("Typed after restore");
    });
    await waitFor(() => expect(saved()?.question).toBe("Typed after restore"), slow);
    expect(saved()?.title).toBe("Earlier draft");
  });

  it("Discard draft clears storage and every field", async () => {
    writeIssueDraft(key, { title: "To discard", question: "Some details", courseSlug: "web", moduleSlug: "m", contentSlug: "", tags: "" });
    const { container } = renderForm();
    await findIssueTextbox();
    fireEvent.click(await screen.findByRole("button", { name: "Discard draft" }, slow));

    expect(window.localStorage.getItem(key)).toBeNull();
    expect(input(container, "title").value).toBe("");
    expect(input(container, "question").value).toBe("");
    expect(input(container, "moduleSlug").value).toBe("");
    expect(document.querySelector("[data-issue-draft-restored]")).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("clears the draft on a valid submit and saves it again if the server rejects it", async () => {
    let reject: (value: { fieldErrors: Record<string, string[]> }) => void = () => {};
    createStudentIssueAction.mockImplementation(
      () => new Promise<{ fieldErrors: Record<string, string[]> }>((resolve) => {
        reject = resolve;
      }),
    );
    const { container } = renderForm();
    const box = await findIssueTextbox();
    fireEvent.change(input(container, "title"), { target: { value: "Assignment link 404" } });
    act(() => {
      editorOf(box).commands.insertContent("The submit link on module 5 returns a 404 every time.");
    });
    await waitFor(() => expect(saved()?.title).toBe("Assignment link 404"), slow);

    fireEvent.submit(container.querySelector("form")!);
    expect(window.localStorage.getItem(key)).toBeNull();
    await waitFor(() => expect(createStudentIssueAction).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 700));
    // Still in flight: nothing re-saved.
    expect(window.localStorage.getItem(key)).toBeNull();

    await act(async () => reject({ fieldErrors: { _form: ["Try again"] } }));
    await waitFor(() => expect(saved()?.title).toBe("Assignment link 404"), slow);
  });

  it("does not touch storage without a draft key", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { container } = render(<StudentIssueForm courses={courses} csrfToken="csrf" />);
    await findIssueTextbox();
    fireEvent.change(input(container, "title"), { target: { value: "No key here" } });
    await new Promise((resolve) => setTimeout(resolve, 700));
    // Other components (theme) may use storage; no draft key is ever written.
    expect(setItem.mock.calls.filter(([name]) => String(name).includes("issue-draft"))).toEqual([]);
    setItem.mockRestore();
  });
});

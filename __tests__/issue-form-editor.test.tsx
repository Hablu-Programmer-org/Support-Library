import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { createIssueAction, updateIssueAction } = vi.hoisted(() => ({
  createIssueAction: vi.fn(async (...args: [unknown, FormData]) => {
    void args;
    return { fieldErrors: {} };
  }),
  updateIssueAction: vi.fn(async (...args: [string, unknown, FormData]) => {
    void args;
    return { fieldErrors: {} };
  }),
}));
vi.mock("@/actions/issues", () => ({ createIssueAction, updateIssueAction }));
vi.mock("@/actions/lms", () => ({ lookupLmsStudentAction: vi.fn(async () => null) }));

import { IssueForm } from "@/components/issues/issue-form";
import { staffIssueDetailsProblem } from "@/lib/issue-content-rules";

import { editorOf, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);
beforeEach(() => {
  createIssueAction.mockClear();
  updateIssueAction.mockClear();
});

/** The editor chunk loads lazily, which is slow under a full parallel run. */
const slow = { timeout: 4000 };
const detailsBox = () => screen.findByRole("textbox", { name: "Issue details" }, slow);
const answerBox = () => screen.findByRole("textbox", { name: "Answer" }, slow);
const hidden = (container: HTMLElement, name: string) =>
  container.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement;

describe("staffIssueDetailsProblem", () => {
  it("uses the create minimum on a new issue and the old floor on an edit", () => {
    expect(staffIssueDetailsProblem("  ", "create")).toBe("Describe the issue.");
    expect(staffIssueDetailsProblem("Page broken", "create")).toMatch(/at least 40/);
    expect(staffIssueDetailsProblem("The assignment page shows a blank screen after login.", "create")).toBeNull();
    expect(staffIssueDetailsProblem("Page broken", "edit")).toBeNull();
    expect(staffIssueDetailsProblem("Bug", "edit")).toBe("Add at least 5 characters.");
    expect(staffIssueDetailsProblem("x".repeat(20_001), "edit")).toMatch(/20,000 characters or fewer/);
  });
});

describe("IssueForm editors", () => {
  it("creates with the details and the answer as Markdown", async () => {
    const { container } = render(<IssueForm minimal csrfToken="csrf" />);
    const details = await detailsBox();
    const answer = await answerBox();
    expect(container.querySelector("textarea[name='question'], textarea[name='solutionBody']")).toBeNull();

    act(() => {
      editorOf(details).commands.setContent("The **deploy** page returns 404 after the last release.", {
        contentType: "markdown",
        emitUpdate: true,
      });
      editorOf(answer).commands.setContent("Run `npm run build` again.", { contentType: "markdown", emitUpdate: true });
    });
    fireEvent.change(container.querySelector('input[name="title"]')!, { target: { value: "Deploy 404" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(createIssueAction).toHaveBeenCalledTimes(1));
    const data = createIssueAction.mock.calls[0][1];
    expect(data.get("question")).toBe("The **deploy** page returns 404 after the last release.");
    expect(data.get("solutionBody")).toBe("Run `npm run build` again.");
  });

  it("blocks short details on create, says why and focuses the editor", async () => {
    const { container } = render(<IssueForm minimal csrfToken="csrf" />);
    const details = await detailsBox();
    act(() => {
      editorOf(details).commands.insertContent("Page broken");
    });

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText(/Add at least 40 characters/)).toBeInTheDocument();
    expect(details.getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(editorOf(details).isFocused).toBe(true));
    expect(createIssueAction).not.toHaveBeenCalled();
  });

  it("reports the details when a native rule blocks the submit first", async () => {
    const { container } = render(<IssueForm minimal csrfToken="csrf" />);
    await detailsBox();
    const title = container.querySelector('input[name="title"]') as HTMLInputElement;
    expect(title.checkValidity()).toBe(false);

    fireEvent.invalid(title);

    expect(await screen.findByText("Describe the issue.")).toBeInTheDocument();
  });

  it("starts the edit page from the saved Markdown and keeps it untouched", async () => {
    const question = "Steps:\n\n1. open the page\n2. see `TypeError`";
    const { container } = render(
      <IssueForm
        csrfToken="csrf"
        supportIssue={{
          id: "665f1f77bcf86cd799439011",
          title: "Old issue",
          question,
          status: "OPEN",
          priority: "NORMAL",
          tags: [],
          uploads: [],
          updatedAt: "2026-11-01T00:00:00.000Z",
        } as never}
      />,
    );
    const details = await detailsBox();

    expect(details.querySelectorAll("li")).toHaveLength(2);
    expect(hidden(container, "question").value).toBe(question);
    expect(screen.queryByRole("textbox", { name: "Answer" })).toBeNull();
  });
});

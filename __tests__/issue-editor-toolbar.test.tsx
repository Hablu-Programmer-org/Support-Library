import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";

import { IssueEditor, ISSUE_EDITOR_SKELETON_GROUPS } from "@/components/issues/issue-editor";
import { ISSUE_EDITOR_TOOL_GROUPS, normalizeIssueLink } from "@/components/issues/issue-editor-toolbar";

import { editorOf, findIssueTextbox, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form>
      <IssueEditor id="q" name="question" label="Issue details" value={value} onChange={setValue} />
      <output data-testid="markdown">{value}</output>
    </form>
  );
}

const markdown = () => screen.getByTestId("markdown").textContent;
const toolbar = () => screen.getByRole("toolbar", { name: "Formatting" });
const tool = (name: string) => within(toolbar()).getByRole("button", { name });

async function setup(initial = "") {
  render(<Harness initial={initial} />);
  const box = await findIssueTextbox();
  return { box, editor: editorOf(box) };
}

describe("IssueEditorToolbar structure", () => {
  it("is a labelled toolbar of named, shortcut-annotated 44px buttons with one tab stop", async () => {
    await setup();
    const buttons = within(toolbar()).getAllByRole("button");

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Bold", "Italic", "Inline code", "Heading", "Bulleted list", "Numbered list", "Code block", "Link", "Undo", "Redo",
    ]);
    for (const button of buttons) {
      expect(button.getAttribute("aria-keyshortcuts")).toMatch(/^(Control|Meta)\+/);
      expect(button.className).toContain("size-11");
      // Visual tooltip carries the same name plus the shortcut.
      expect(button.querySelector('span[aria-hidden="true"]')?.textContent).toContain(button.getAttribute("aria-label"));
    }
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(toolbar().getAttribute("aria-controls")).toBe("q");
  });

  it("moves focus with arrow keys, Home and End (roving tabindex)", async () => {
    await setup();
    const buttons = within(toolbar()).getAllByRole("button");
    buttons[0].focus();

    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].tabIndex).toBe(0);
    expect(buttons[0].tabIndex).toBe(-1);

    fireEvent.keyDown(buttons[1], { key: "End" });
    expect(document.activeElement).toBe(buttons.at(-1));
    fireEvent.keyDown(buttons.at(-1)!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons.at(-1));
    fireEvent.keyDown(buttons.at(-1)!, { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("keeps the loading skeleton's toolbar the same shape as the real one", () => {
    expect(ISSUE_EDITOR_SKELETON_GROUPS).toEqual(ISSUE_EDITOR_TOOL_GROUPS.map((group) => group.length));
  });

  it("does not steal the editor selection on mouse down", async () => {
    await setup();
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    tool("Bold").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("IssueEditorToolbar formatting (spec examples)", () => {
  it.each([
    ["Bold", "**npm run dev**"],
    ["Italic", "*npm run dev*"],
    ["Inline code", "`npm run dev`"],
    ["Heading", "## npm run dev"],
    ["Bulleted list", "- npm run dev"],
    ["Numbered list", "1. npm run dev"],
    ["Code block", "```\nnpm run dev\n```"],
  ])("%s on selected text gives %j", async (name, expected) => {
    const { editor } = await setup("npm run dev");
    act(() => {
      editor.commands.selectAll();
    });

    fireEvent.click(tool(name));

    expect(markdown()).toBe(expected);
    // Pressed state follows the caret; put it inside the first block's text
    // (the end of the doc is Tiptap's trailing empty paragraph).
    act(() => {
      editor.commands.setTextSelection(3);
    });
    await waitFor(() => expect(tool(name).getAttribute("aria-pressed")).toBe("true"));
  });

  it("turns three lines into a bulleted list", async () => {
    const { editor } = await setup("one\n\ntwo\n\nthree");
    act(() => {
      editor.commands.selectAll();
    });
    fireEvent.click(tool("Bulleted list"));
    expect(markdown()).toBe("- one\n- two\n- three");
  });

  it("marks inline tools unavailable inside a code block", async () => {
    const { editor } = await setup("```\nconst a = 1;\n```");
    act(() => {
      editor.commands.setTextSelection(3);
    });

    await waitFor(() => expect(tool("Bold").getAttribute("aria-disabled")).toBe("true"));
    expect(tool("Link").getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(tool("Bold"));
    expect(markdown()).toBe("```\nconst a = 1;\n```");
  });

  it("undoes and redoes with the buttons, disabled when there is nothing to do", async () => {
    const { editor } = await setup();
    expect(tool("Undo").getAttribute("aria-disabled")).toBe("true");
    expect(tool("Redo").getAttribute("aria-disabled")).toBe("true");

    act(() => {
      editor.commands.insertContent("typed text");
    });
    await waitFor(() => expect(tool("Undo").getAttribute("aria-disabled")).toBeNull());
    expect(tool("Undo").hasAttribute("aria-pressed")).toBe(false);

    fireEvent.click(tool("Undo"));
    expect(markdown()).toBe("");
    await waitFor(() => expect(tool("Redo").getAttribute("aria-disabled")).toBeNull());

    fireEvent.click(tool("Redo"));
    expect(markdown()).toBe("typed text");
  });
});

describe("IssueEditorToolbar link panel", () => {
  const selectWord = async (initial: string, from: number, to: number) => {
    const ctx = await setup(initial);
    act(() => {
      ctx.editor.commands.setTextSelection({ from, to });
    });
    return ctx;
  };

  it("links the selection, adding https:// to a bare address", async () => {
    await selectWord("see docs here", 5, 9);
    fireEvent.click(tool("Link"));

    const input = await screen.findByLabelText("Link address");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "nextjs.org/docs" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(markdown()).toBe("see [docs](https://nextjs.org/docs) here");
    expect(screen.queryByLabelText("Link address")).toBeNull();
  });

  it("inserts the address itself when nothing is selected", async () => {
    const { editor } = await setup("Read ");
    act(() => {
      editor.commands.focus("end");
    });
    fireEvent.click(tool("Link"));
    const input = await screen.findByLabelText("Link address");
    fireEvent.change(input, { target: { value: "https://example.com/a" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));

    expect(markdown()).toBe("Read [https://example.com/a](https://example.com/a)");
  });

  it("refuses javascript: and other non-web addresses", async () => {
    await selectWord("see docs here", 5, 9);
    fireEvent.click(tool("Link"));
    const input = await screen.findByLabelText("Link address");

    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "hello"]) {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(screen.getByRole("alert").textContent).toMatch(/Use a web address/);
      expect(input.getAttribute("aria-invalid")).toBe("true");
    }
    expect(markdown()).toBe("see docs here");
  });

  it("edits and removes an existing link", async () => {
    await selectWord("see [docs](https://a.dev) here", 6, 7);
    await waitFor(() => expect(tool("Link").getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(tool("Link"));

    const input = (await screen.findByLabelText("Link address")) as HTMLInputElement;
    expect(input.value).toBe("https://a.dev");
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));

    expect(markdown()).toBe("see docs here");
  });

  it("closes on Escape without changing anything", async () => {
    await selectWord("see docs here", 5, 9);
    fireEvent.click(tool("Link"));
    const input = await screen.findByLabelText("Link address");
    fireEvent.change(input, { target: { value: "https://a.dev" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByLabelText("Link address")).toBeNull();
    expect(markdown()).toBe("see docs here");
  });

  it("opens from Mod-K inside the editor", async () => {
    const { box } = await selectWord("see docs here", 5, 9);
    fireEvent.keyDown(box, { key: "k", ctrlKey: true });
    expect(await screen.findByLabelText("Link address")).toBeInTheDocument();
  });
});

describe("normalizeIssueLink", () => {
  it("accepts web addresses and rejects everything else", () => {
    expect(normalizeIssueLink("https://a.dev/x")).toBe("https://a.dev/x");
    expect(normalizeIssueLink("http://a.dev")).toBe("http://a.dev");
    expect(normalizeIssueLink("  example.com/page ")).toBe("https://example.com/page");
    expect(normalizeIssueLink("localhost:3000/api")).toBe("https://localhost:3000/api");
    expect(normalizeIssueLink("")).toBeNull();
    expect(normalizeIssueLink("hello")).toBeNull();
    expect(normalizeIssueLink("javascript:alert(1)")).toBeNull();
    expect(normalizeIssueLink("data:text/html,x")).toBeNull();
    expect(normalizeIssueLink("ftp://a.dev")).toBeNull();
  });
});

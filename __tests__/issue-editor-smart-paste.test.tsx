import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";

import { IssueEditor } from "@/components/issues/issue-editor";

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
const chip = () => document.querySelector("[data-issue-editor-paste-chip]");

/** jsdom has no DataTransfer; ProseMirror only reads getData() and files. */
function paste(target: HTMLElement, data: Record<string, string>) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (type: string) => data[type] ?? "", files: [], types: Object.keys(data), items: [] },
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

async function setup(initial = "") {
  render(<Harness initial={initial} />);
  const box = await findIssueTextbox();
  const editor = editorOf(box);
  act(() => {
    editor.commands.focus("end");
  });
  return { box, editor };
}

const TRACE = "TypeError: Cannot read properties of undefined (reading 'map')\n    at App (App.jsx:12:5)";

describe("smart paste", () => {
  it("turns a pasted stack trace into a code block and offers Undo (spec example)", async () => {
    const { box } = await setup();
    const event = paste(box, { "text/plain": TRACE });

    expect(event.defaultPrevented).toBe(true);
    expect(markdown()).toBe(`\`\`\`\n${TRACE}\n\`\`\``);
    expect(chip()?.textContent).toContain("Formatted as code");
    expect(screen.getByText("Pasted text was formatted as a code block.")).toBeInTheDocument();
  });

  it("Undo turns the block back into the pasted lines as plain text", async () => {
    const { box } = await setup("My error:");
    paste(box, { "text/plain": TRACE });
    expect(markdown()).toBe(`My error:\n\n\`\`\`\n${TRACE}\n\`\`\``);

    fireEvent.click(screen.getByRole("button", { name: /Undo code formatting/ }));

    expect(markdown()).toBe("My error:\n\nTypeError: Cannot read properties of undefined (reading 'map')\n\nat App (App.jsx:12:5)");
    expect(chip()).toBeNull();
  });

  it("retires the chip on the next edit, so Undo can never touch newer text", async () => {
    const { box, editor } = await setup();
    paste(box, { "text/plain": TRACE });
    expect(chip()).not.toBeNull();

    act(() => {
      editor.commands.insertContent("more");
    });

    expect(chip()).toBeNull();
    expect(screen.queryByText("Pasted text was formatted as a code block.")).toBeNull();
  });

  it("keeps a fenced paste's language and drops the fence", async () => {
    const { box } = await setup();
    paste(box, { "text/plain": "```tsx\nconst a = 1;\nexport default a;\n```" });
    expect(markdown()).toBe("```tsx\nconst a = 1;\nexport default a;\n```");
  });

  it("uses the plain text of a VS Code copy, not its styled HTML", async () => {
    const { box } = await setup();
    paste(box, {
      "text/plain": "const a = 1;\nconsole.log(a);",
      "text/html": '<div style="color:#d4d4d4;font-family:Consolas"><div><span style="color:#569cd6">const</span> a = 1;</div><div>console.log(a);</div></div>',
    });
    expect(markdown()).toBe("```\nconst a = 1;\nconsole.log(a);\n```");
  });

  it("leaves two Bangla lines as normal text (spec example)", async () => {
    const { box } = await setup();
    const event = paste(box, { "text/plain": "আমার কোড রান হচ্ছে না।\nকী করব বুঝতে পারছি না।" });

    expect(event.defaultPrevented).toBe(true); // ProseMirror's own paste handled it
    expect(markdown()).not.toContain("```");
    expect(markdown()).toContain("আমার কোড রান হচ্ছে না।");
    expect(chip()).toBeNull();
  });

  it("lets a structured document (ChatGPT, Docs) paste normally", async () => {
    const { box } = await setup();
    paste(box, {
      "text/plain": "Try this:\nconst a = 1;\nconsole.log(a);",
      "text/html": "<p>Try this:</p><pre><code>const a = 1;\nconsole.log(a);</code></pre>",
    });

    expect(chip()).toBeNull();
    expect(markdown()).toBe("Try this:\n\n```\nconst a = 1;\nconsole.log(a);\n```");
  });

  it("does nothing special when pasting inside a code block", async () => {
    const { box, editor } = await setup("```\nfirst\n```");
    act(() => {
      editor.commands.setTextSelection(3); // inside "first"
    });
    paste(box, { "text/plain": TRACE });

    expect(chip()).toBeNull();
    expect(markdown()?.match(/```/g)).toHaveLength(2);
    expect(markdown()).toContain("at App (App.jsx:12:5)");
  });
});

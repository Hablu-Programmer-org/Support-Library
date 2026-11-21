import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { MarkdownField } from "@/components/shared/markdown-field";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form aria-label="harness">
      <MarkdownField
        id="q"
        label="Issue details"
        name="question"
        value={value}
        onChange={setValue}
        required
        minLength={40}
        maxLength={20_000}
        footer={<span>{value.length} chars</span>}
      />
    </form>
  );
}

const textarea = () => screen.getByLabelText("Issue details") as HTMLTextAreaElement;
const tab = (name: "Write" | "Preview") => screen.getByRole("tab", { name });

describe("MarkdownField", () => {
  it("starts on Write with the textarea visible and wired to its label", () => {
    render(<Harness />);
    expect(tab("Write").getAttribute("aria-selected")).toBe("true");
    expect(textarea().closest("[hidden]")).toBeNull();
    expect(textarea().name).toBe("question");
  });

  it("keeps the text when switching to Preview and back", () => {
    render(<Harness />);
    fireEvent.change(textarea(), { target: { value: "hello **world**" } });
    fireEvent.click(tab("Preview"));
    fireEvent.click(tab("Write"));
    expect(textarea().value).toBe("hello **world**");
    expect(screen.getByText("15 chars")).toBeTruthy();
  });

  it("renders the preview with the same markdown renderer as the issue page", () => {
    render(<Harness initial={"## Error\n\n```js\nconsole.log(x)\n```\n\n- step one"} />);
    fireEvent.click(tab("Preview"));
    const panel = screen.getByRole("tabpanel", { name: "Preview" });
    expect(panel.querySelector("h2")?.textContent).toBe("Error");
    expect(panel.querySelector("pre code")?.textContent).toBe("console.log(x)");
    expect(panel.querySelector("li")?.textContent).toBe("step one");
  });

  it("keeps the textarea in the form (hidden) while previewing, so it still submits", () => {
    const { container } = render(<Harness initial="some text" />);
    fireEvent.click(tab("Preview"));
    const field = container.querySelector('textarea[name="question"]') as HTMLTextAreaElement;
    expect(field).not.toBeNull();
    expect(field.closest("[hidden]")).not.toBeNull();
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("question")).toBe("some text");
  });

  it("shows attack input as text in the preview", () => {
    render(<Harness initial={'<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror="alert(1)">'} />);
    fireEvent.click(tab("Preview"));
    const panel = screen.getByRole("tabpanel", { name: "Preview" });
    expect(panel.querySelector("script")).toBeNull();
    expect(panel.querySelector("img")).toBeNull();
    expect(panel.querySelector("a")).toBeNull();
    expect(panel.textContent).toContain("<script>alert(1)</script>");
  });

  it("says when there is nothing to preview", () => {
    render(<Harness />);
    fireEvent.click(tab("Preview"));
    expect(screen.getByText("Nothing to preview yet.")).toBeTruthy();
  });

  it("switches tabs with the arrow keys and moves focus", () => {
    render(<Harness />);
    tab("Write").focus();
    fireEvent.keyDown(tab("Write"), { key: "ArrowRight" });
    expect(tab("Preview").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Preview"));
    fireEvent.keyDown(tab("Preview"), { key: "Home" });
    expect(tab("Write").getAttribute("aria-selected")).toBe("true");
  });

  it("returns to Write when the browser rejects the field during Preview", () => {
    render(<Harness initial="too short" />);
    fireEvent.click(tab("Preview"));
    fireEvent.invalid(textarea());
    expect(tab("Write").getAttribute("aria-selected")).toBe("true");
    expect(textarea().closest("[hidden]")).toBeNull();
  });
});

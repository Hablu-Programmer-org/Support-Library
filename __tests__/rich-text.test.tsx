import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichText } from "@/lib/rich-text";

const renderText = (text?: string | null, className?: string) => {
  const { container } = render(<RichText text={text} className={className} />);
  return container;
};

describe("RichText", () => {
  it("renders **text** as a strong element", () => {
    const container = renderText("This is **important** for you");

    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("important");
    expect(container.textContent).toBe("This is important for you");
  });

  it("renders every bold pair and keeps the plain runs around them", () => {
    const container = renderText("**one** middle **two** end");

    const strongs = Array.from(container.querySelectorAll("strong"));
    expect(strongs.map((node) => node.textContent)).toEqual(["one", "two"]);
    expect(container.textContent).toBe("one middle two end");
  });

  it("keeps an unclosed marker literal", () => {
    const container = renderText("**open without a close");

    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toBe("**open without a close");
  });

  it("does not bold a pair that wraps only whitespace", () => {
    const container = renderText("before ** ** after");

    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toBe("before ** ** after");
  });

  it("keeps a newline inside a bold pair", () => {
    const container = renderText("**first\nsecond**");

    expect(container.querySelector("strong")?.textContent).toBe("first\nsecond");
  });

  it("renders markup characters as text, never as elements", () => {
    const container = renderText("<b>bold</b> <script>alert(1)</script>");

    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("<b>bold</b> <script>alert(1)</script>");
  });

  it("passes the paragraph classes through", () => {
    const container = renderText("plain", "whitespace-pre-wrap");

    expect(container.querySelector("p")?.className).toContain("whitespace-pre-wrap");
  });

  it("renders an empty paragraph for missing text", () => {
    expect(renderText(undefined).textContent).toBe("");
    expect(renderText(null).textContent).toBe("");
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseRichText, RichText } from "@/lib/rich-text";

const renderText = (text?: string | null, className?: string) => {
  const { container } = render(<RichText text={text} className={className} />);
  return container;
};

describe("RichText bold", () => {
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

  it("passes the container classes through", () => {
    const container = renderText("plain", "whitespace-pre-wrap");

    expect(container.firstElementChild?.className).toContain("whitespace-pre-wrap");
  });

  it("renders an empty paragraph for missing text", () => {
    expect(renderText(undefined).textContent).toBe("");
    expect(renderText(null).textContent).toBe("");
  });
});

describe("RichText block Markdown", () => {
  it("renders all heading levels without showing the markers", () => {
    const container = renderText(
      "# One\n## Two\n### ধাপ ১: WhatsApp Business Account প্রস্তুত করুন\n#### Four\n##### Five\n###### Six",
    );

    for (let level = 1; level <= 6; level += 1) {
      expect(container.querySelector(`h${level}`)).not.toBeNull();
    }
    expect(container.querySelector("h3")?.textContent).toBe(
      "ধাপ ১: WhatsApp Business Account প্রস্তুত করুন",
    );
    expect(container.textContent).not.toContain("###");
  });

  it("renders lists, tasks, quotes, rules and multiline paragraphs", () => {
    const container = renderText(
      "প্রথম লাইন\nদ্বিতীয় লাইন\n\n- one\n- [x] done\n\n3. three\n4. four\n\n> quoted\n\n---",
    );

    expect(container.querySelector("p")?.className).toContain("whitespace-pre-wrap");
    expect(container.querySelector("p")?.textContent).toContain("প্রথম লাইন\nদ্বিতীয় লাইন");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelector("ul li:nth-child(2)")?.textContent).toContain("☑ done");
    expect(container.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(container.querySelector("blockquote")?.textContent).toBe("quoted");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("renders fenced code literally and labels its language", () => {
    const container = renderText("```ts\nconst x = '**not bold**';\n```");

    expect(container.querySelector("pre code")?.textContent).toContain("**not bold**");
    expect(container.querySelector("pre strong")).toBeNull();
    expect(container.textContent).toContain("ts");
  });

  it("renders a GFM-style table with alignment", () => {
    const container = renderText("| Name | Status |\n| :--- | ---: |\n| API | **Ready** |");
    const cells = container.querySelectorAll("td");

    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(cells).toHaveLength(2);
    expect(cells[1].style.textAlign).toBe("right");
    expect(cells[1].querySelector("strong")?.textContent).toBe("Ready");
  });

  it("supports italic, strike, inline code and safe image links", () => {
    const container = renderText(
      "*italic* snake_case ~~old~~ `**literal**` ![diagram](https://example.com/a.png)",
    );

    expect(container.querySelector("em")?.textContent).toBe("italic");
    expect(container.textContent).toContain("snake_case");
    expect(container.querySelector("del")?.textContent).toBe("old");
    expect(container.querySelector("code")?.textContent).toBe("**literal**");
    expect(container.querySelector("a")?.textContent).toBe("🖼 diagram");
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps unsafe image targets and HTML literal", () => {
    const container = renderText("![x](javascript:alert(1)) <img src=x onerror=alert(1)>");

    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("![x](javascript:alert(1))");
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("RichText links", () => {
  it("renders [label](url) as a new-tab anchor", () => {
    const container = renderText("Join here: [লিংকে ক্লিক করুন](https://n8n.example.com/signup?token=abc)");

    const link = container.querySelector("a");
    expect(link?.textContent).toBe("লিংকে ক্লিক করুন");
    expect(link?.getAttribute("href")).toBe("https://n8n.example.com/signup?token=abc");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("uses the URL as the label when the label is empty", () => {
    const container = renderText("[](https://example.com/watch?v=1)");

    expect(container.querySelector("a")?.textContent).toBe("https://example.com/watch?v=1");
  });

  it("turns a bare https URL into a clickable link", () => {
    const container = renderText("Watch https://example.com/watch?v=1 now");

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/watch?v=1");
    expect(link?.textContent).toBe("https://example.com/watch?v=1");
    expect(container.textContent).toBe("Watch https://example.com/watch?v=1 now");
  });

  it("leaves trailing sentence punctuation outside the bare URL", () => {
    const container = renderText("See https://example.com/a.");

    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com/a");
    expect(container.textContent).toBe("See https://example.com/a.");
  });

  it("keeps javascript: and data: targets as text", () => {
    const container = renderText(
      "[x](javascript:alert(1)) [y](data:text/html,hi)",
    );

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("[x](javascript:alert(1)) [y](data:text/html,hi)");
  });

  it("keeps a relative link as text", () => {
    const container = renderText("[dash](/dashboard)");

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("[dash](/dashboard)");
  });

  it("supports bold inside a link label", () => {
    const container = renderText("[**very** important](https://example.com)");

    const link = container.querySelector("a");
    expect(link?.textContent).toBe("very important");
    expect(link?.querySelector("strong")?.textContent).toBe("very");
  });

  it("supports a link inside bold", () => {
    const container = renderText("**[watch](https://example.com/v)**");

    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("watch");
    expect(strong?.querySelector("a")?.getAttribute("href")).toBe("https://example.com/v");
  });

  it("keeps link syntax literal when links are disabled", () => {
    const { container } = render(
      <p>{parseRichText("see [x](https://example.com)", { links: false })}</p>,
    );

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("see [x](https://example.com)");
  });
});

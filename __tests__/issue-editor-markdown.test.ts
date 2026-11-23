import { Editor, type JSONContent } from "@tiptap/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  escapeIssueText,
  getIssueMarkdown,
  isAllowedIssueLink,
  issueEditorExtensions,
  roundTripIssueMarkdown,
} from "@/lib/issue-editor-markdown";
import { RichText } from "@/lib/rich-text";

/**
 * Piece 1 of the Tiptap issue editor: the stored `question` stays Markdown that
 * RichText renders. Every case here is Markdown -> Tiptap -> Markdown, and the
 * result must either be byte-identical or render identically in RichText.
 */

const html = (markdown: string) => renderToStaticMarkup(createElement(RichText, { text: markdown }));

const editors: Editor[] = [];
const makeEditor = (content?: string) => {
  const editor = new Editor({
    extensions: issueEditorExtensions(),
    ...(content === undefined ? {} : { content, contentType: "markdown" as const }),
  });
  editors.push(editor);
  return editor;
};
afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

const linkHrefs = (node: JSONContent): string[] => [
  ...(node.marks ?? []).filter((mark) => mark.type === "link").map((mark) => String(mark.attrs?.href)),
  ...(node.content ?? []).flatMap(linkHrefs),
];

/** Shapes that already exist in stored issues; each must come back unchanged. */
const IDENTICAL: Record<string, string> = {
  "Bangla + emoji paragraphs with a soft line break":
    "প্রথম লাইন\nএকই paragraph-এর দ্বিতীয় লাইন\n\nনতুন paragraph 😅",
  "inline marks": "**bold** and *italic* and `npm run dev` and ~~gone~~",
  "markdown link": "দেখুন [Next.js docs](https://nextjs.org/docs/app) এখানে",
  "bullet list": "- এক\n- দুই\n- তিন",
  "ordered list": "1. first\n2. second\n3. third",
  "ordered list that starts later": "3. third\n4. fourth",
  "nested list": "- parent\n  - child\n- next",
  "task list": "- [ ] todo\n- [x] done",
  "h1 / h2 / h3": "# Big\n\n## কী করতে চাচ্ছিলাম\n\nলেখা\n\n### ছোট heading\n\nআরও",
  "fenced code with language and a blank line": "```js\nconst a = 1;\n\nconsole.log(a);\n```",
  "fenced stack trace without language":
    "```\nTypeError: Cannot read properties of undefined (reading 'map')\n    at App (App.jsx:12:5)\n```",
  "code that looks like HTML and markdown": "```html\n<div class=\"a\">**not bold** &amp; &lt;</div>\n```",
  blockquote: "> quoted line\n> second",
  "horizontal rule": "above\n\n---\n\nbelow",
  "hard line break": "line one  \nline two",
  "operators in prose": "a && b < 5 > 2 and `x && y`",
  "HTML typed as prose (block)": "<script>alert(1)</script> and <img src=x onerror=alert(1)>",
  "HTML typed as prose (inline)": "my <div className=\"card\"> does not show",
  "backslash escapes": "1\\. not a list and \\*not italic\\*",
  "escaped block markers on later lines": "plain\n1\\. not list\n\\- not bullet\n\\# not heading",
};

/** Markdown changes spelling but RichText output must be the same. */
const RENDER_EQUAL: Record<string, string> = {
  "bare URL becomes an explicit link": "আর https://example.com/a?b=1 দেখুন",
  "table gets padded": "| a | b |\n| --- | --- |\n| 1 | 2 |",
  "underscores get escaped": "use snake_case_name here",
  "image becomes a labelled link": "![error screenshot](https://res.cloudinary.com/demo/x.png)",
  "image without alt text": "![](https://res.cloudinary.com/demo/x.png)",
};

/** A realistic student issue mixing everything above. */
const REAL_ISSUE = [
  "## কী করতে চাচ্ছিলাম",
  "",
  "Module 5-এর **todo app**-এ `useEffect` দিয়ে data fetch করছি।",
  "",
  "## কী হলো",
  "",
  "```",
  "TypeError: Cannot read properties of undefined (reading 'map')",
  "    at TodoList (TodoList.jsx:14:22)",
  "```",
  "",
  "## কী try করেছি",
  "",
  "1. `npm install` আবার দিয়েছি",
  "2. [এই answer](https://stackoverflow.com/q/1) দেখেছি",
  "3. `todos && todos.map(...)` লিখেছি, তাও <ul> খালি 😢",
].join("\n");

describe("issue editor markdown round trip", () => {
  it.each(Object.entries(IDENTICAL))("%s comes back byte-identical", (_, markdown) => {
    expect(roundTripIssueMarkdown(markdown)).toBe(markdown);
  });

  it.each(Object.entries(RENDER_EQUAL))("%s renders the same in RichText", (_, markdown) => {
    expect(html(roundTripIssueMarkdown(markdown))).toBe(html(markdown));
  });

  it("escapes lone stars, so RichText stops reading `2 * 3 * 4` as italic", () => {
    // Known RichText quirk: the raw text renders "2 <em> 3 </em> 4". The
    // editor's output shows the stars as typed, which is the intended reading.
    const out = roundTripIssueMarkdown("2 * 3 * 4 = 24");

    expect(out).toBe("2 \\* 3 \\* 4 = 24");
    expect(html(out)).not.toContain("<em>");
    expect(html(out)).toContain("2 * 3 * 4 = 24");
  });

  it("keeps a realistic Bangla issue byte-identical", () => {
    expect(roundTripIssueMarkdown(REAL_ISSUE)).toBe(REAL_ISSUE);
  });

  it.each([...Object.values(IDENTICAL), ...Object.values(RENDER_EQUAL), REAL_ISSUE])(
    "is stable on a second pass (draft reload) #%#",
    (markdown) => {
      const once = roundTripIssueMarkdown(markdown);
      expect(roundTripIssueMarkdown(once)).toBe(once);
    },
  );
});

describe("issue editor markdown safety", () => {
  it("drops javascript: and data: links but keeps their text", () => {
    const editor = makeEditor("[x](javascript:alert(1)) and [y](data:text/html,hi) and [ok](https://ok.dev)");

    expect(linkHrefs(editor.getJSON())).toEqual(["https://ok.dev"]);
    expect(getIssueMarkdown(editor)).toBe("x and y and [ok](https://ok.dev)");
  });

  it("drops unsafe links set later through setContent as well", () => {
    const editor = makeEditor();
    editor.commands.setContent("[x](javascript:alert(1))", { contentType: "markdown" });

    expect(linkHrefs(editor.getJSON())).toEqual([]);
  });

  it("does not turn a javascript: image into a link", () => {
    const out = roundTripIssueMarkdown("![x](javascript:alert(1))");
    expect(out).not.toMatch(/\]\(javascript:/);
  });

  it("keeps typed HTML as text that RichText never executes", () => {
    const editor = makeEditor();
    editor.commands.insertContent({ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script><img src=x onerror=alert(1)>" }] });

    const markdown = getIssueMarkdown(editor);
    expect(markdown).toBe("<script>alert(1)</script><img src=x onerror=alert(1)>");
    expect(html(markdown)).not.toMatch(/<script|<img/);
    expect(html(markdown)).toContain("&lt;script&gt;");
  });

  it("strips styling from pasted rich HTML and keeps bold, lists and code", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      '<p><span style="color:red;font-size:20px">Hi <b>there</b></span> <code>npm i</code></p><ul><li><font color="blue">one</font></li></ul><iframe src="https://evil.example"></iframe>',
    );

    expect(getIssueMarkdown(editor)).toBe("Hi **there** `npm i`\n\n- one");
  });

  it("allows only absolute http(s) link targets", () => {
    expect(isAllowedIssueLink("https://a.dev")).toBe(true);
    expect(isAllowedIssueLink("http://a.dev")).toBe(true);
    expect(isAllowedIssueLink("javascript:alert(1)")).toBe(false);
    expect(isAllowedIssueLink("data:text/html,x")).toBe(false);
    expect(isAllowedIssueLink("/relative")).toBe(false);
  });
});

describe("issue editor markdown for typed content (spec examples)", () => {
  it("serialises typed operators without HTML entities", () => {
    const editor = makeEditor();
    editor.commands.insertContent({ type: "paragraph", content: [{ type: "text", text: "if (a && b < 5) return x > 2" }] });

    expect(getIssueMarkdown(editor)).toBe("if (a && b < 5) return x > 2");
  });

  it("drops a paragraph's leading indent so it never reloads as a code block", () => {
    const editor = makeEditor();
    editor.commands.insertContent([
      { type: "paragraph", content: [{ type: "text", text: "Error:" }] },
      { type: "paragraph", content: [{ type: "text", text: "    at App (App.jsx:12:5)" }] },
    ]);

    const markdown = getIssueMarkdown(editor);
    expect(markdown).toBe("Error:\n\nat App (App.jsx:12:5)");
    expect(roundTripIssueMarkdown(markdown)).toBe(markdown);
  });

  it("escapes a typed line that only looks like a list, heading or quote", () => {
    const editor = makeEditor();
    editor.commands.insertContent({ type: "paragraph", content: [{ type: "text", text: "1. step one\n- dash\n# hash\n> arrow\n---" }] });

    const markdown = getIssueMarkdown(editor);
    expect(markdown).toBe("1\\. step one\n\\- dash\n\\# hash\n\\> arrow\n\\---");
    const rendered = html(markdown);
    expect(rendered).not.toMatch(/<(ol|ul|h1|blockquote|hr)\b/);
    expect(rendered).toContain("1. step one\n- dash\n# hash\n&gt; arrow\n---");
  });

  it("selected text + Code gives an inline code span", () => {
    const editor = makeEditor("npm run dev");
    editor.chain().selectAll().toggleCode().run();

    expect(getIssueMarkdown(editor)).toBe("`npm run dev`");
  });

  it("Bullet on three lines gives a dash list", () => {
    const editor = makeEditor("one\n\ntwo\n\nthree");
    editor.chain().selectAll().toggleBulletList().run();

    expect(getIssueMarkdown(editor)).toBe("- one\n- two\n- three");
  });

  it("Code block keeps a pasted stack trace verbatim", () => {
    const trace = "TypeError: Cannot read properties of undefined\n    at App (App.jsx:12:5)";
    const editor = makeEditor();
    editor.commands.insertContent({ type: "codeBlock", content: [{ type: "text", text: trace }] });

    expect(getIssueMarkdown(editor)).toBe(`\`\`\`\n${trace}\n\`\`\``);
  });
});

describe("escapeIssueText", () => {
  it("escapes inline markdown and line-start block markers only", () => {
    expect(escapeIssueText("a*b_c [x] `y` ~z~ \\")).toBe("a\\*b\\_c \\[x\\] \\`y\\` \\~z\\~ \\\\");
    expect(escapeIssueText("version 1.2 - ok #1 a > b")).toBe("version 1.2 - ok #1 a > b");
    expect(escapeIssueText("  2. indented")).toBe("  2\\. indented");
  });
});

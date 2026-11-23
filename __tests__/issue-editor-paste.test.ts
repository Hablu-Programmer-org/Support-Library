import { describe, expect, it } from "vitest";

import { isStructuredHtml, looksLikeCode, pastedCode } from "@/lib/issue-editor-paste";

describe("looksLikeCode", () => {
  it.each([
    ["JS stack trace (spec example)", "TypeError: Cannot read properties of undefined (reading 'map')\n    at App (App.jsx:12:5)"],
    ["React stack with node_modules frames", "Error: Hydration failed\n    at throwOnHydrationMismatch (react-dom.development.js:12507:9)\n    at tryToClaimNextHydratableInstance (react-dom.development.js:12535:7)"],
    ["Python traceback", "Traceback (most recent call last):\n  File \"app.py\", line 3, in <module>\n    print(x)\nNameError: name 'x' is not defined"],
    ["npm failure", "npm ERR! code ENOENT\nnpm ERR! syscall open"],
    ["terminal session", "$ npm run dev\n> next dev -p 3000"],
    ["JS snippet", "const todos = data.map((t) => t.title);\nconsole.log(todos);"],
    ["JSX component", "export default function App() {\n  return <div className=\"app\">{items}</div>;\n}"],
    ["JSON", "{\n  \"name\": \"todo\",\n  \"version\": \"1.0.0\"\n}"],
    ["Python function", "def add(a, b):\n    return a + b"],
    ["CSS rule", ".card {\n  display: flex;\n}"],
    ["already fenced block", "```js\nconst a = 1\n```"],
  ])("treats %s as code", (_, text) => {
    expect(looksLikeCode(text)).toBe(true);
  });

  it.each([
    ["two Bangla lines (spec example)", "আমার কোড রান হচ্ছে না।\nকী করব বুঝতে পারছি না।"],
    ["English prose", "I followed the module video.\nThe page still shows nothing after login."],
    ["prose with brackets", "I tried npm install (twice).\nStill broken after restarting VS Code."],
    ["a Markdown list", "- cleared the cache\n- reinstalled node modules\n- restarted"],
    ["numbered steps", "1. open the page\n2. click submit\n3. nothing happens"],
    ["a single command", "npm run dev"],
    ["a single error line", "TypeError: Cannot read properties of undefined"],
    ["mixed prose with one code line", "My code is below.\nI do not understand why.\nconst x = 1;\nPlease help."],
    ["empty", "  \n\n "],
  ])("leaves %s as text", (_, text) => {
    expect(looksLikeCode(text)).toBe(false);
  });
});

describe("isStructuredHtml", () => {
  it("is true for documents and false for editor copies", () => {
    expect(isStructuredHtml("<p>Hi</p><pre><code>x</code></pre>")).toBe(true);
    expect(isStructuredHtml("<ul><li>a</li></ul>")).toBe(true);
    expect(isStructuredHtml("<h2>Title</h2>")).toBe(true);
    // VS Code copies lines as styled divs and spans.
    expect(isStructuredHtml('<div style="font-family: Consolas"><div><span>const</span> a</div></div>')).toBe(false);
    expect(isStructuredHtml("")).toBe(false);
  });
});

describe("pastedCode", () => {
  it("normalises line endings, trims outer blank lines and keeps indentation", () => {
    expect(pastedCode("\r\n\r\n  if (a) {\r\n    b();\r\n  }\r\n\r\n")).toEqual({
      code: "  if (a) {\n    b();\n  }",
      language: null,
    });
  });

  it("unwraps a fenced block and keeps its language", () => {
    expect(pastedCode("```tsx\nconst a = 1;\n```\n")).toEqual({ code: "const a = 1;", language: "tsx" });
    expect(pastedCode("```\nplain\nlines\n```")).toEqual({ code: "plain\nlines", language: null });
  });
});

import { Editor, Extension, type AnyExtension, type JSONContent } from "@tiptap/react";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import {
  Marked,
  Tokenizer,
  type marked as markedModule,
  type Tokens,
  type TokenizerAndRendererExtension,
} from "marked";

/**
 * The issue editor stores plain Markdown that `lib/rich-text` renders. Tiptap's
 * Markdown defaults assume an HTML renderer, so three seams are adjusted here
 * (all covered by __tests__/issue-editor-markdown.test.ts — re-run it when
 * bumping any @tiptap/* or marked version; they are pinned exactly):
 *
 * 1. HTML in Markdown stays literal text. Students ask about `<div>` and
 *    `<script>`; RichText shows those characters as typed, so the editor must
 *    neither drop them nor turn them into nodes.
 * 2. Text is not HTML-entity encoded. RichText never decodes entities, so
 *    `a && b` must be saved as typed, not as `a &amp;&amp; b`.
 * 3. A line that starts with `1.`, `-`, `+`, `#` or `>` as plain text is
 *    backslash-escaped so RichText does not turn it into a list/heading/quote,
 *    and a paragraph's leading indent is dropped (it would read as code).
 *
 * Links only keep http(s) targets. There is no image node: screenshots go
 * through AttachmentField because they stay private until publish. Old
 * `![alt](url)` Markdown becomes a link labelled like RichText shows it.
 */

/** Only absolute http(s) links survive; mirrors `safeHref` in lib/rich-text. */
export function isAllowedIssueLink(url: string): boolean {
  try {
    const { protocol } = new URL(url.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Same pattern RichText uses for images, so both agree on what is an image. */
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]*)\)/;

const imageAsLink: TokenizerAndRendererExtension = {
  name: "issueImageAsLink",
  level: "inline",
  start: (src) => {
    const index = src.indexOf("![");
    return index === -1 ? undefined : index;
  },
  tokenizer(src) {
    const match = IMAGE.exec(src);
    if (!match || !isAllowedIssueLink(match[2])) return undefined;
    const label = `🖼 ${match[1].trim() || match[2]}`;
    return {
      type: "link",
      raw: match[0],
      href: match[2],
      title: null,
      text: label,
      tokens: [{ type: "text", raw: label, text: label }],
    };
  },
};

/**
 * A marked instance whose HTML tokens come out as literal text. The stock
 * tokenizers still decide where the HTML is (so CommonMark edge cases match);
 * only the token they return is rewritten. Inline HTML becomes an `escape`
 * token because Tiptap copies those verbatim (a `text` token would have its
 * entities decoded); block HTML becomes a paragraph of that inline content.
 * marked types an override as returning the same token kind, hence the casts.
 */
function createIssueMarked(): typeof markedModule {
  const marked = new Marked();
  marked.use({
    tokenizer: {
      tag(src) {
        const token = Tokenizer.prototype.tag.call(this, src);
        if (!token) return undefined;
        const literal: Tokens.Escape = { type: "escape", raw: token.raw, text: token.raw };
        return literal as unknown as Tokens.Tag;
      },
      html(src) {
        const token = Tokenizer.prototype.html.call(this, src);
        if (!token) return undefined;
        const text = token.raw.replace(/\n+$/, "");
        const paragraph: Tokens.Paragraph = { type: "paragraph", raw: token.raw, text, tokens: this.lexer.inline(text) };
        return paragraph as unknown as Tokens.HTML;
      },
    },
    extensions: [imageAsLink],
  });
  // Tiptap types this option as the `marked` module; it only reads `Lexer`
  // and `defaults`, which a Marked instance has. A fresh instance per editor
  // keeps these overrides away from any other marked user in the bundle.
  return marked as unknown as typeof markedModule;
}

/** Remove link marks whose target is not http(s); keep their text. */
function stripUnsafeLinks(node: JSONContent): JSONContent {
  const marks = node.marks?.filter(
    (mark) => mark.type !== "link" || isAllowedIssueLink(String(mark.attrs?.href ?? "")),
  );
  return {
    ...node,
    ...(node.marks ? { marks } : {}),
    ...(node.content ? { content: node.content.map(stripUnsafeLinks) } : {}),
  };
}

const LINE_START_MARKERS = [
  /^(\s*\d+)\.(?=\s|$)/gm, //   "1. "  -> "1\. "
  /^(\s*)([-+])(?=\s|$)/gm, //  "- "   -> "\- "
  /^(\s*)(#{1,6})(?=\s|$)/gm, // "# "  -> "\# "
  /^(\s*)(>)/gm, //            "> "   -> "\> "
  /^(\s*)(-{3,}|_{3,})\s*$/gm, // "---" -> "\---"
];

/** Escape for plain (non-code) text. No HTML entities: RichText is not HTML. */
export function escapeIssueText(text: string): string {
  let escaped = text.replace(/([\\`*_[\]~])/g, "\\$1");
  escaped = escaped.replace(LINE_START_MARKERS[0], "$1\\.");
  for (const pattern of LINE_START_MARKERS.slice(1)) {
    escaped = escaped.replace(pattern, (_, lead: string, marker: string) => `${lead}\\${marker}`);
  }
  return escaped;
}

type TextEncoder = (text: string, node: JSONContent, parent?: JSONContent) => string;
type PatchableManager = {
  parse: (markdown: string) => JSONContent;
  encodeTextForMarkdown: TextEncoder;
};

/**
 * Wraps two MarkdownManager methods on this editor's own instance. Both are
 * TypeScript-private, hence the cast; the tests fail loudly if they change.
 */
const IssueMarkdownSeams = Extension.create({
  name: "issueMarkdownSeams",
  // Must run after Markdown.onBeforeCreate has built `editor.markdown`.
  priority: 10,
  onBeforeCreate() {
    const manager = this.editor.markdown as unknown as PatchableManager | undefined;
    if (!manager) return;

    const parse = manager.parse.bind(manager);
    manager.parse = (markdown) => stripUnsafeLinks(parse(markdown));

    const encode = manager.encodeTextForMarkdown.bind(manager);
    manager.encodeTextForMarkdown = (text, node, parent) => {
      // The original returns code text untouched and entity-encodes the rest;
      // probing with "&" tells us which case this node is without reading the
      // private `codeTypes` set.
      const insideCode = encode("&", node, parent) === "&";
      if (insideCode) return text;
      // 4+ spaces at the start of a paragraph is an indented code block in
      // Markdown (and every parser drops the indent anyway), so a pasted
      // "    at App (...)" line would come back as code on the next load.
      const opensParagraph = parent?.type === "paragraph" && parent.content?.[0] === node;
      return escapeIssueText(opensParagraph ? text.replace(/^[ \t]+/, "") : text);
    };

    // The initial `content` was already parsed by Markdown.onBeforeCreate.
    const initial = this.editor.options.content;
    if (initial && typeof initial === "object" && !Array.isArray(initial)) {
      this.editor.options.content = stripUnsafeLinks(initial as JSONContent);
    }
  },
});

/** The one schema the issue editor uses, shared by the React editor and tests. */
export function issueEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https"],
        isAllowedUri: (url) => isAllowedIssueLink(url),
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit,
    Markdown.configure({ marked: createIssueMarked() }),
    IssueMarkdownSeams,
  ];
}

/**
 * The value that goes into the hidden `question` input. Trailing blank lines
 * come from Tiptap's trailing empty paragraph after a list or code block.
 */
export function getIssueMarkdown(editor: Pick<Editor, "getMarkdown">): string {
  return editor.getMarkdown().replace(/\s+$/, "");
}

/** Markdown -> Tiptap document -> Markdown, with no DOM view. */
export function roundTripIssueMarkdown(markdown: string): string {
  const editor = new Editor({
    extensions: issueEditorExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  try {
    return getIssueMarkdown(editor);
  } finally {
    editor.destroy();
  }
}

/**
 * Smart paste for the issue editor: decide whether pasted plain text is code
 * (an error, a stack trace, a snippet, terminal output) so it can land in a
 * code block instead of being reflowed as prose. Pure functions, no editor.
 */

/** Any one of these lines makes the whole paste code. */
const STRONG_SIGNALS = [
  /^\s*at\s+\S.*(?::\d+(?::\d+)?\)?|\((?:native|<anonymous>)\))\s*$/, // JS stack frame
  /^Traceback \(most recent call last\):/, //                            Python traceback
  /^\s*File ".+", line \d+/, //                                          Python frame
  /^\s*npm (?:ERR!|error)/, //                                           npm failure
  /^\s*(?:\$|PS [A-Z]:\\[^>]*>)\s+\S/, //                                shell prompt
];

/** A line that looks like code on its own. Half the lines must match. */
const CODE_LINE = [
  /[;{}]\s*$/, //                                    ends a statement / block
  /=>\s*\{?\s*$/, //                                 arrow function
  /^\s*(?:const|let|var|function|import|export|return|class|def|from|async|await|try|catch|finally|public|private|protected|interface|type|enum|package|using|#include)\b/,
  /^\s*(?:if|for|while|switch|elif|else)\b.*[:{(]\s*$/,
  /^\s*<\/?[A-Za-z][\w.-]*(?:\s[^>]*)?\/?>/, //      HTML / JSX tag
  /^\s*[}\])]/, //                                   closing bracket
  /^\s*(?:\/\/|\/\*|\*\/|#!)/, //                     comment / shebang
  /^\s*"[^"]+"\s*:/, //                              JSON key
  /^\s*[A-Za-z_][\w.]*(?:Error|Exception|Warning)\b:/, // "TypeError: ..."
  /^(?:\t| {2,})\S/, //                               indented
];

/**
 * True when multi-line plain text reads as code. A single line never does
 * (selecting a command and pressing Code is the inline path), and ordinary
 * prose — Bangla or English, with or without a list — never does.
 */
export function looksLikeCode(text: string): boolean {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  // An already fenced block (copied from a README or an answer).
  if (/^```[\w+-]*\n[\s\S]*\n```$/.test(normalized)) return true;
  const lines = normalized.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return false;
  if (lines.some((line) => STRONG_SIGNALS.some((pattern) => pattern.test(line)))) return true;
  const codeLines = lines.filter((line) => CODE_LINE.some((pattern) => pattern.test(line))).length;
  return codeLines >= 2 && codeLines * 2 >= lines.length;
}

/**
 * HTML from a document (ChatGPT, Google Docs, a web page) has real structure
 * that the normal paste keeps. Editors such as VS Code copy only styled
 * `<div>`/`<span>` lines, which carry no structure worth keeping.
 */
export function isStructuredHtml(html: string): boolean {
  return /<(?:p|li|ul|ol|h[1-6]|pre|table|blockquote)\b/i.test(html);
}

export type PastedCode = { code: string; language: string | null };

/**
 * The code block content for a paste: line endings normalised, outer blank
 * lines dropped (inner indentation kept), and a fenced ```lang block unwrapped
 * so the fence does not end up inside the code block.
 */
export function pastedCode(text: string): PastedCode {
  let code = text.replace(/\r\n?/g, "\n").replace(/^(?:[ \t]*\n)+/, "").replace(/\s+$/, "");
  let language: string | null = null;
  const fenced = /^```([\w+-]*)[ \t]*\n([\s\S]*?)\n```$/.exec(code);
  if (fenced) {
    language = fenced[1] || null;
    code = fenced[2];
  }
  return { code, language };
}

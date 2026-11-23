/**
 * The "Use template" outline for a student issue. Shared by the editor (which
 * inserts it and shows each hint as a placeholder), the client checks and the
 * server's create schema, so the headings never count as the student's words.
 */
export const ISSUE_TEMPLATE_SECTIONS = [
  { heading: "কী করতে চাচ্ছিলাম", hint: "কোন lesson বা assignment-এ কী করার চেষ্টা করছিলেন" },
  { heading: "কী হলো", hint: "কী error বা ভুল দেখলেন? Error message হুবহু paste করুন" },
  { heading: "কী try করেছি", hint: "এখন পর্যন্ত কী কী চেষ্টা করেছেন" },
] as const;

/** The outline as Markdown (headings only; the editor adds a line under each). */
export const issueTemplateMarkdown = ISSUE_TEMPLATE_SECTIONS.map(({ heading }) => `## ${heading}`).join("\n\n");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A Markdown heading line (any level) whose text is a template heading. */
const TEMPLATE_HEADING_LINE = new RegExp(
  `^ {0,3}#{1,6}[ \\t]+(?:${ISSUE_TEMPLATE_SECTIONS.map(({ heading }) => escapeRegex(heading)).join("|")})[ \\t]*#*[ \\t]*$`,
);
const ANY_HEADING_LINE = /^ {0,3}#{1,6}[ \t]+\S/;
const FENCE_LINE = /^\s*```/;

/** The hint for the paragraph under a template heading, if that is one. */
export function templateHintFor(headingText: string): string | undefined {
  return ISSUE_TEMPLATE_SECTIONS.find(({ heading }) => heading === headingText.trim())?.hint;
}

type Line = { text: string; inFence: boolean };

function classifyLines(markdown: string): Line[] {
  let inFence = false;
  return markdown.replace(/\r\n?/g, "\n").split("\n").map((text) => {
    const fence = FENCE_LINE.test(text);
    const line = { text, inFence: inFence || fence };
    if (fence) inFence = !inFence;
    return line;
  });
}

const isTemplateHeading = (line: Line) => !line.inFence && TEMPLATE_HEADING_LINE.test(line.text);

export function hasTemplateHeadings(markdown: string): boolean {
  return classifyLines(markdown).some(isTemplateHeading);
}

/** The Markdown without template heading lines: what the student wrote. */
export function withoutTemplateHeadings(markdown: string): string {
  return classifyLines(markdown)
    .filter((line) => !isTemplateHeading(line))
    .map((line) => line.text)
    .join("\n");
}

/**
 * Drop template sections the student left empty, so a submitted issue never
 * shows a bare "কী try করেছি" heading. Filled sections stay as written.
 */
export function withoutEmptyTemplateSections(markdown: string): string {
  const lines = classifyLines(markdown);
  const keep = lines.map(() => true);
  lines.forEach((line, index) => {
    if (!isTemplateHeading(line)) return;
    let end = index + 1;
    while (end < lines.length && !(ANY_HEADING_LINE.test(lines[end].text) && !lines[end].inFence)) end += 1;
    const body = lines.slice(index + 1, end);
    if (body.every((bodyLine) => !bodyLine.text.trim())) {
      for (let drop = index; drop < end; drop += 1) keep[drop] = false;
    }
  });
  return lines
    .filter((_, index) => keep[index])
    .map((line) => line.text)
    .join("\n")
    // No blank-line collapsing: a dropped section takes its own blank lines,
    // and code blocks may contain blank lines on purpose.
    .trim();
}

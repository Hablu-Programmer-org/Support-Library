export type SolutionPrefillInput = {
  title: string;
  question: string;
  tags?: readonly string[] | null;
  /** Latest non-internal reply, used as the suggested fix if there is one. */
  replyBody?: string | null;
};

export type SolutionPrefill = {
  title: string;
  summary: string;
  body: string;
  tags: string;
};

const clip = (value: string, max: number) => value.trim().slice(0, max);

/**
 * Builds solution form defaults from a support case.
 *
 * Pure on purpose so the mapping can be unit tested without a database. The
 * result is only a starting point: a mentor still has to clean it up, which is
 * why callers keep the new solution INTERNAL.
 */
export function buildSolutionPrefill(input: SolutionPrefillInput): SolutionPrefill {
  const question = input.question.trim();
  const reply = input.replyBody?.trim();

  const body = [
    `## Problem\n${question}`,
    reply ? `## Suggested fix\n${reply}` : "",
    "## Steps\n1. ",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: clip(`Fix: ${input.title}`, 200),
    summary: clip(question.replace(/\s+/g, " "), 500),
    body: clip(body, 100_000),
    tags: (input.tags ?? []).join(", "),
  };
}
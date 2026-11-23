import type { ComponentProps } from "react";

import { AttachmentList } from "@/components/shared/attachment-list";
import { SectionLabel } from "@/components/shared/section-label";
import { RichText } from "@/lib/rich-text";

type IssueProblemSectionProps = {
  question: string;
  uploads: ComponentProps<typeof AttachmentList>["uploads"];
  tags: string[];
};

/**
 * The case's question as a card. The question is Markdown and goes through the
 * same safe `RichText` renderer as replies: React nodes only, never parsed as
 * HTML, links limited to http(s).
 */
export function IssueProblemSection({
  question,
  uploads,
  tags,
}: IssueProblemSectionProps) {
  return (
    <section
      aria-labelledby="problem-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900/70"
    >
      <SectionLabel id="problem-heading">Issue details</SectionLabel>

      <RichText
        text={question}
        className="mt-4 text-base leading-8 text-slate-800 dark:text-slate-100"
      />

      {uploads.length > 0 ? (
        <div className="mt-6 space-y-4">
          {/* Published cases are reviewed before they reach the library, so
              their evidence images are part of the student-facing answer. */}
          <AttachmentList uploads={uploads} />
        </div>
      ) : null}

      {tags.length > 0 ? (
        <ul
          aria-label="Issue tags"
          className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5 dark:border-slate-800"
        >
          {tags.map((tag) => (
            <li
              key={tag}
              className="max-w-full wrap-break-word rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              #{tag}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

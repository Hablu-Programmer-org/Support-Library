"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { IssueSearchField } from "@/components/issues/issue-search-field";
import { ChevronDownIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { nativeFieldClass, nativeLabelClass, nativeSelectClass } from "@/lib/config/fields";
import {
  buildIssueListHref,
  ISSUES_PATH,
  ISSUE_SORTS,
  resolveDefaultIssueSort,
  type IssueFilterDefaults,
  type IssueSort,
} from "@/lib/issue-list-params";
import {
  primaryButtonClass,
  secondaryButtonClass,
  surfaceClass,
} from "@/lib/ui";

const statusLabels: Record<string, string> = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const sortLabels: Record<IssueSort, string> = {
  answer: "Answer needed first",
  newest: "Newest first",
  oldest: "Oldest first",
  priority: "Priority",
  relevance: "Best match",
};

type IssueFilterPanelProps = {
  defaults: IssueFilterDefaults;
  statuses: readonly string[];
  courseSlugs: string[];
  batchNos: number[];
  mentors: { id: string; name: string }[];
  showMentor?: boolean;
  /** Result summary ("Total 228 issues") shown beside the active-filter chips. */
  summary?: ReactNode;
};

type ChipKey = Exclude<keyof IssueFilterDefaults, "sort">;

/**
 * The advanced fields as user-editable drafts.
 *
 * They are controlled (not `defaultValue`) so a client-side navigation
 * (chip removal, tag suggestion, back/forward) replaces them with the URL
 * values. `q` is deliberately not part of the draft: typing in the search
 * box navigates on `q` alone and must not wipe unsubmitted advanced edits.
 * Tags have no field of their own — the search box finds them, and a `tag=`
 * link (empty state, shared URL) still lands on a removable chip.
 */
type AdvancedDraft = Pick<
  IssueFilterDefaults,
  "status" | "courseSlug" | "batchNo" | "mentorId" | "from" | "to" | "sort"
>;

const advancedDraftFrom = (defaults: IssueFilterDefaults): AdvancedDraft => ({
  status: defaults.status,
  courseSlug: defaults.courseSlug,
  batchNo: defaults.batchNo,
  mentorId: defaults.mentorId,
  from: defaults.from,
  to: defaults.to,
  sort: defaults.sort,
});

/**
 * Line two of the toolbar: every advanced filter on a single row from tablet
 * width up (five equal columns, so no field is half the width of its
 * neighbour), stacking to two columns on a large phone and one on a phone.
 * It expands inside the same card (never as a floating overlay), and stays
 * mounted while collapsed so the form still submits it.
 */
function AdvancedFields({
  draft,
  onDraftChange,
  courseSlugs,
  batchNos,
  mentors,
  showMentor = true,
}: {
  draft: AdvancedDraft;
  onDraftChange: (patch: Partial<AdvancedDraft>) => void;
  courseSlugs: string[];
  batchNos: number[];
  mentors: { id: string; name: string }[];
  showMentor?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 md:gap-2",
        showMentor ? "md:grid-cols-5" : "md:grid-cols-4",
      )}
    >
      <label className={nativeLabelClass}>
        Course
        <select
          className={nativeSelectClass}
          name="courseSlug"
          onChange={(event) => onDraftChange({ courseSlug: event.target.value })}
          value={draft.courseSlug}
        >
          <option value="">All courses</option>
          {courseSlugs.map((slug) => (
            <option key={slug} value={slug}>
              {slug}
            </option>
          ))}
        </select>
      </label>

      <label className={nativeLabelClass}>
        Batch
        <select
          className={nativeSelectClass}
          name="batchNo"
          onChange={(event) => onDraftChange({ batchNo: event.target.value })}
          value={draft.batchNo}
        >
          <option value="">All batches</option>
          {batchNos.map((batch) => (
            <option key={batch} value={String(batch)}>
              {batch}
            </option>
          ))}
        </select>
      </label>

      {showMentor && (
        <label className={nativeLabelClass}>
          Mentor
          <select
            className={nativeSelectClass}
            name="mentorId"
            onChange={(event) => onDraftChange({ mentorId: event.target.value })}
            value={draft.mentorId}
          >
            <option value="">All mentors</option>
            {mentors.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>
                {mentor.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={nativeLabelClass}>
        From date
        <input
          className={nativeFieldClass}
          name="from"
          onChange={(event) => onDraftChange({ from: event.target.value })}
          type="date"
          value={draft.from}
        />
      </label>

      <label className={nativeLabelClass}>
        To date
        <input
          className={nativeFieldClass}
          name="to"
          onChange={(event) => onDraftChange({ to: event.target.value })}
          type="date"
          value={draft.to}
        />
      </label>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="sticky top-16 z-30 bg-white/90 py-2 backdrop-blur-md dark:bg-slate-950/90">
      <div className={cn(surfaceClass, "flex flex-col gap-2 p-2 lg:flex-row lg:items-center")}>
        <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="flex gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-100 sm:w-28 dark:bg-slate-800" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-100 sm:w-28 dark:bg-slate-800" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-100 sm:w-11 dark:bg-slate-800" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-100 sm:w-20 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function IssueFilterPanel({
  defaults,
  statuses,
  courseSlugs,
  batchNos,
  mentors,
  showMentor,
  summary,
}: IssueFilterPanelProps) {
  const [mounted, setMounted] = useState(false);
  // Line two is closed on load — a keyword or an existing filter is answered by
  // the chips below the card, not by an expanded form the user did not ask for.
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedDraft>(() => advancedDraftFrom(defaults));

  const advancedCount = [
    defaults.tag,
    defaults.status,
    defaults.courseSlug,
    defaults.batchNo,
    defaults.mentorId,
    defaults.from,
    defaults.to,
  ].filter(Boolean).length;
  const defaultSort = resolveDefaultIssueSort({ canManage: Boolean(showMentor), q: defaults.q });

  // A client-side navigation (chip, tag suggestion, Reset, back/forward) changes
  // the advanced defaults. Adopt them so the controls match the URL instead of
  // showing the mount-time values. `q` is not synced: typing a search navigates
  // on `q` only, and must keep unsubmitted advanced edits.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-navigation sync
    setDraft((prev) => ({
      ...prev,
      status: defaults.status,
      courseSlug: defaults.courseSlug,
      batchNo: defaults.batchNo,
      mentorId: defaults.mentorId,
      from: defaults.from,
      to: defaults.to,
    }));
  }, [
    defaults.status,
    defaults.courseSlug,
    defaults.batchNo,
    defaults.mentorId,
    defaults.from,
    defaults.to,
  ]);

  // The sort follows the URL on its own: typing a query flips the default to
  // relevance, and the select must show that without touching field drafts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-navigation sync
    setDraft((prev) => (prev.sort === defaults.sort ? prev : { ...prev, sort: defaults.sort }));
  }, [defaults.sort]);

  const patchDraft = (patch: Partial<AdvancedDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only render pattern
    setMounted(true);
  }, []);

  const toggle = () => setOpen((prev) => !prev);

  const mentorName = mentors.find((mentor) => mentor.id === defaults.mentorId)?.name;
  const chips: { key: ChipKey; label: string }[] = [];
  if (defaults.q) chips.push({ key: "q", label: `“${defaults.q}”` });
  if (defaults.status) {
    chips.push({
      key: "status",
      label: `Status: ${statusLabels[defaults.status] ?? defaults.status}`,
    });
  }
  if (defaults.tag) chips.push({ key: "tag", label: `Tag: ${defaults.tag}` });
  if (defaults.courseSlug) {
    chips.push({ key: "courseSlug", label: `Course: ${defaults.courseSlug}` });
  }
  if (defaults.batchNo) chips.push({ key: "batchNo", label: `Batch: ${defaults.batchNo}` });
  if (defaults.mentorId) {
    chips.push({ key: "mentorId", label: `Mentor: ${mentorName ?? "selected"}` });
  }
  if (defaults.from) chips.push({ key: "from", label: `From: ${defaults.from}` });
  if (defaults.to) chips.push({ key: "to", label: `To: ${defaults.to}` });

  const chipHref = (key: ChipKey) => {
    const next = { ...defaults, page: 1, [key]: "" };
    return buildIssueListHref(next, { defaultSort });
  };

  // "Clear filters" keeps the keyword: the search box is a different control,
  // and wiping it from here would punish a user who meant only the filters.
  const clearFiltersHref = buildIssueListHref(
    {
      ...defaults,
      page: 1,
      status: "",
      tag: "",
      courseSlug: "",
      batchNo: "",
      mentorId: "",
      from: "",
      to: "",
    },
    { defaultSort },
  );

  // Server render: minimal skeleton (no SVG icons)
  if (!mounted) {
    return <PanelSkeleton />;
  }

  const selectClass = `${nativeSelectClass} sm:w-auto`;

  return (
    <form
      action={ISSUES_PATH}
      className="sticky top-16 z-30 bg-white/90 py-2 backdrop-blur-md dark:bg-slate-950/90"
      method="get"
    >
      <div className={cn(surfaceClass, "p-2")}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="min-w-0 lg:flex-1">
            <IssueSearchField defaults={defaults} defaultSort={defaultSort} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <label className="sr-only" htmlFor="issue-status">
              Status
            </label>
            <select
              className={selectClass}
              id="issue-status"
              name="status"
              onChange={(event) => patchDraft({ status: event.target.value })}
              value={draft.status}
            >
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item] ?? item}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="issue-sort">
              Sort by
            </label>
            <select
              className={selectClass}
              id="issue-sort"
              name="sort"
              onChange={(event) => patchDraft({ sort: event.target.value as IssueSort })}
              value={draft.sort}
            >
              {(showMentor ? ISSUE_SORTS : ISSUE_SORTS.filter((item) => item !== "answer")).map(
                (item) => (
                  <option key={item} value={item}>
                    {sortLabels[item]}
                  </option>
                ),
              )}
            </select>

            <button
              aria-controls="issue-advanced-filters"
              aria-expanded={open}
              aria-label="Advanced filters"
              className={cn(secondaryButtonClass, "w-11 px-0 py-2.5")}
              onClick={toggle}
              type="button"
            >
              <ChevronDownIcon
                className={cn("transition-transform duration-200", open && "rotate-180")}
                size={18}
              />
            </button>

            <button className={cn(primaryButtonClass, "col-span-2 py-2.5 sm:col-span-1")} type="submit">
              Filter
            </button>
          </div>
        </div>

        {/*
          Line two of the same card. The fields stay mounted while collapsed: a
          hidden input is still submitted, so pressing Enter in the search box or
          clicking Filter keeps every advanced filter instead of dropping them.
        */}
        <div
          className={cn(open ? "mt-2 border-t border-slate-200 pt-3 dark:border-slate-800" : "hidden")}
          id="issue-advanced-filters"
        >
          <AdvancedFields
            batchNos={batchNos}
            courseSlugs={courseSlugs}
            draft={draft}
            mentors={mentors}
            onDraftChange={patchDraft}
            showMentor={showMentor}
          />
        </div>
      </div>

      {/*
        The result count and the active filters live outside the collapsed line,
        so a closed panel never hides *why* the list is filtered.
      */}
      <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
        {summary && (
          <p aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">
            {summary}
          </p>
        )}
        {chips.map((chip) => (
          <Link
            key={chip.key}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            href={chipHref(chip.key)}
          >
            <span className="max-w-48 truncate">{chip.label}</span>
            <CloseIcon size={12} />
          </Link>
        ))}
        {advancedCount > 0 && (
          <Link
            className="rounded px-1 text-xs font-semibold text-primary-700 transition hover:underline dark:text-primary-300"
            href={clearFiltersHref}
          >
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}

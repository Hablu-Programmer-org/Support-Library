"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

import { IssueSearchField } from "@/components/issues/issue-search-field";
import { CloseIcon } from "@/components/icons";
import { nativeFieldClass, nativeLabelClass, nativeSelectClass } from "@/lib/config/fields";
import {
  buildIssueListHref,
  ISSUE_SORTS,
  resolveDefaultIssueSort,
  type IssueFilterDefaults,
  type IssueSort,
} from "@/lib/issue-list-params";

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
};

type ChipKey = Exclude<keyof IssueFilterDefaults, "sort">;

/**
 * The advanced fields as user-editable drafts.
 *
 * They are controlled (not `defaultValue`) so a client-side navigation
 * (chip removal, tag suggestion, Reset, back/forward) replaces them with the
 * URL values. `q` is deliberately not part of the draft: typing in the search
 * box navigates on `q` alone and must not wipe unsubmitted advanced edits.
 */
type AdvancedDraft = Pick<
  IssueFilterDefaults,
  "tag" | "status" | "courseSlug" | "batchNo" | "mentorId" | "from" | "to" | "sort"
>;

const advancedDraftFrom = (defaults: IssueFilterDefaults): AdvancedDraft => ({
  tag: defaults.tag,
  status: defaults.status,
  courseSlug: defaults.courseSlug,
  batchNo: defaults.batchNo,
  mentorId: defaults.mentorId,
  from: defaults.from,
  to: defaults.to,
  sort: defaults.sort,
});

function FilterFields({
  defaults,
  draft,
  onDraftChange,
  statuses,
  courseSlugs,
  batchNos,
  mentors,
  showMentor = true,
  defaultSort,
}: IssueFilterPanelProps & {
  defaultSort: IssueSort;
  draft: AdvancedDraft;
  onDraftChange: (patch: Partial<AdvancedDraft>) => void;
}) {
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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={nativeLabelClass}>
          Tag
          <input
            className={nativeFieldClass}
            name="tag"
            onChange={(event) => onDraftChange({ tag: event.target.value })}
            value={draft.tag}
          />
        </label>

        <label className={nativeLabelClass}>
          Sort by
          <select
            className={nativeSelectClass}
            name="sort"
            onChange={(event) => onDraftChange({ sort: event.target.value as IssueSort })}
            value={draft.sort}
          >
            {(showMentor ? ISSUE_SORTS : ISSUE_SORTS.filter((item) => item !== "answer")).map((item) => (
              <option key={item} value={item}>
                {sortLabels[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <label className={nativeLabelClass}>
          Status
          <select
            className={nativeSelectClass}
            name="status"
            onChange={(event) => onDraftChange({ status: event.target.value })}
            value={draft.status}
          >
            <option value="">All</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item] ?? item}
              </option>
            ))}
          </select>
        </label>

        <label className={nativeLabelClass}>
          Course
          <select
            className={nativeSelectClass}
            name="courseSlug"
            onChange={(event) => onDraftChange({ courseSlug: event.target.value })}
            value={draft.courseSlug}
          >
            <option value="">All</option>
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
            <option value="">All</option>
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
              <option value="">All</option>
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

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {chips.length > 0 ? `Active filters: ${chips.length}` : ""}
        </span>
        <div className="flex gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            href="/dashboard/issues"
            role="button"
          >
            Reset
          </Link>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-primary-100 px-3 py-1.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-200 dark:bg-primary-900 dark:text-primary-100 dark:hover:bg-primary-800"
            type="submit"
          >
            Filter
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({
  defaults,
  defaultSort,
  open,
  onToggle,
}: {
  defaults: IssueFilterDefaults;
  defaultSort: IssueSort;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <IssueSearchField
      defaults={defaults}
      defaultSort={defaultSort}
      open={open}
      onToggle={onToggle}
    />
  );
}

function PanelSkeleton() {
  return (
    <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
      <form action="/dashboard/issues" method="get" className="space-y-4">
        <div className="relative">
          <div className="h-10 w-full rounded-lg bg-slate-100 animate-pulse dark:bg-slate-800" />
          <div className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md bg-slate-100 animate-pulse dark:bg-slate-800" />
        </div>
      </form>
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
}: IssueFilterPanelProps) {
  const [mounted, setMounted] = useState(false);
  // A keyword alone keeps the panel collapsed: it is the primary control, not
  // an "advanced filter". Only an advanced filter (or an explicit non-default
  // sort) opens the panel, so a search does not hide the results it produced.
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
  const [open, setOpen] = useState(advancedCount > 0 || defaults.sort !== defaultSort);
  const [draft, setDraft] = useState<AdvancedDraft>(() => advancedDraftFrom(defaults));

  // A client-side navigation (chip, tag suggestion, Reset, back/forward) changes
  // the advanced defaults. Adopt them so the controls match the URL instead of
  // showing the mount-time values. `q` is not synced: typing a search navigates
  // on `q` only, and must keep unsubmitted advanced edits.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-navigation sync
    setDraft((prev) => ({
      ...prev,
      tag: defaults.tag,
      status: defaults.status,
      courseSlug: defaults.courseSlug,
      batchNo: defaults.batchNo,
      mentorId: defaults.mentorId,
      from: defaults.from,
      to: defaults.to,
    }));
  }, [
    defaults.tag,
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

  // A client-side navigation that *adds* an advanced filter (tag suggestion,
  // back/forward) opens the panel, so its chips stay visible. Removing the
  // last one never closes a panel the user opened themselves.
  const previousAdvancedCount = useRef(advancedCount);
  useEffect(() => {
    if (advancedCount > 0 && previousAdvancedCount.current === 0) setOpen(true);
    previousAdvancedCount.current = advancedCount;
  }, [advancedCount]);

  const patchDraft = (patch: Partial<AdvancedDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only render pattern
    setMounted(true);
  }, []);

  const toggle = () => setOpen((prev) => !prev);

  // Server render: minimal skeleton (no SVG icons)
  if (!mounted) {
    return <PanelSkeleton />;
  }

  // Client render: full interactive panel
  return (
    <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
      <form action="/dashboard/issues" method="get" className="space-y-4">
        <PanelHeader defaults={defaults} defaultSort={defaultSort} open={open} onToggle={toggle} />

        {/*
          The fields stay mounted while the panel is collapsed. A hidden input is
          still submitted, so pressing Enter in the search box keeps every filter
          instead of silently dropping the ones that were unmounted.
        */}
        <div className={open ? "" : "hidden"}>
          <FilterFields
            batchNos={batchNos}
            courseSlugs={courseSlugs}
            defaultSort={defaultSort}
            defaults={defaults}
            draft={draft}
            mentors={mentors}
            onDraftChange={patchDraft}
            showMentor={showMentor}
            statuses={statuses}
          />
        </div>
      </form>
    </div>
  );
}

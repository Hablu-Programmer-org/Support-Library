"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { IssueSearchField } from "@/components/issues/issue-search-field";
import { ISSUE_STATUS_LABELS, IssueStatusChips } from "@/components/issues/issue-status-chips";
import { CloseIcon, SlidersIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { nativeFieldClass } from "@/lib/config/fields";
import {
  buildIssueListHref,
  ISSUES_PATH,
  ISSUE_SORTS,
  resolveDefaultIssueSort,
  type IssueFilterDefaults,
  type IssueSort,
} from "@/lib/issue-list-params";

const statusLabels = ISSUE_STATUS_LABELS;

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
  /**
   * Pull the toolbar up over the student hero. The strip behind it turns
   * transparent (a solid strip would cut the hero's edge) and the search card
   * carries its own frosted background so stuck content never shows through.
   */
  floating?: boolean;
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

/** Small caps label over each drawer field (text stays "Status", "Course"...). */
const drawerLabelClass =
  "flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

/** Native control styled for the drawer; native is kept for e2e and mobile pickers. */
const drawerFieldClass = cn(
  nativeFieldClass,
  "h-11 rounded-xl text-sm normal-case tracking-normal font-medium dark:[color-scheme:dark]",
);
const drawerSelectClass = `${drawerFieldClass} select-chevron`;

/*
 * Floating (student) mode sits the search card fully inside the hero's padded
 * bottom. The card is 112px tall: 1px border + 8px padding + 54px bar + 8px gap
 * + 32px status chips + 8px padding + 1px border. With the form's own 8px top
 * padding that is 120px; the hero (`pb-[152px]` in `issues-hero.tsx`) keeps a
 * 16px margin under the card, so the form is pulled up by the 24px page gap +
 * 136px = 160px. The summary row is a page sibling after the form (not sticky),
 * so the page's 24px gap drops it 16px below the hero edge.
 * Change these numbers together.
 *
 * Stuck (scrolled under the header) the floating strip turns solid: an
 * unstuck transparent strip keeps the hero edge visible, but a stuck one must
 * hide the cards scrolling behind it.
 */
const stickyBarClass = (floating: boolean, stuck = false) =>
  floating
    ? cn(
        "sticky top-16 z-30 -mt-[160px] px-3 py-2 transition-colors duration-150 motion-reduce:transition-none sm:px-6",
        stuck &&
          "border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95",
      )
    : "sticky top-16 z-30 bg-white/90 py-2 backdrop-blur-md dark:bg-slate-950/90";

/** The sticky `top-16` offset in px; at or above it the bar is stuck. */
const STICKY_TOP_PX = 64;

const cardClass = (floating: boolean, stuck = false) =>
  cn(
    "rounded-[22px] border border-slate-200 p-2 dark:border-slate-800",
    floating && !stuck
      ? "bg-white/85 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:bg-slate-950/70 dark:shadow-black/40"
      : "bg-white shadow-sm dark:bg-slate-900",
  );

function PanelSkeleton({ floating }: { floating: boolean }) {
  return (
    <>
    <div className={stickyBarClass(floating)}>
      <div className={cardClass(floating)}>
        <div className="h-[54px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="mt-2 flex h-8 items-center gap-1.5 px-1">
          {[40, 52, 60, 64, 76].map((width) => (
            <div
              key={width}
              className="h-7 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800"
              style={{ width }}
            />
          ))}
        </div>
      </div>
    </div>
    <div className={cn(!floating && "-mt-4", "h-5")} />
    </>
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
  floating = false,
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

  // Only the floating (hero) bar changes when stuck. One rect read per frame
  // while scrolling; the state setter bails out when nothing changed.
  const formRef = useRef<HTMLFormElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!floating || !mounted) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const form = formRef.current;
      if (form) setStuck(form.getBoundingClientRect().top <= STICKY_TOP_PX + 0.5);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [floating, mounted]);

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
    return <PanelSkeleton floating={floating} />;
  }

  const filtersButton = (
    <button
      aria-controls="issue-advanced-filters"
      aria-expanded={open}
      aria-label="Advanced filters"
      className={cn(
        "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold transition duration-150 sm:px-3.5",
        open
          ? "bg-cyan-500/15 text-cyan-700 ring-1 ring-inset ring-cyan-500/30 dark:text-cyan-300"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
      )}
      onClick={toggle}
      type="button"
    >
      <SlidersIcon size={18} />
      <span className="hidden sm:inline">Filters</span>
      {advancedCount > 0 && (
        <span
          aria-hidden="true"
          data-testid="active-filter-count"
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
            "bg-cyan-500 text-white",
          )}
        >
          {advancedCount}
        </span>
      )}
    </button>
  );

  return (
    <>
    <form
      ref={formRef}
      action={ISSUES_PATH}
      className={stickyBarClass(floating, stuck)}
      data-stuck={floating && stuck ? "true" : undefined}
      method="get"
    >
      <div className={cardClass(floating, stuck)}>
        <IssueSearchField defaults={defaults} defaultSort={defaultSort} trailing={filtersButton} />
        <IssueStatusChips defaultSort={defaultSort} defaults={defaults} staff={Boolean(showMentor)} />

        {/*
          The drawer. Collapsed, it is 0 rows tall, `invisible` and `inert`: out
          of the tab order and the accessibility tree, yet every field is still a
          form control, so Enter in the search box or a later Filter keeps every
          filter. `visibility` flips at the end of the closing transition, so the
          fields fade out first. Each control exists once (no duplicate `name`).
        */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
            open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
          )}
          data-state={open ? "open" : "closed"}
          id="issue-advanced-filters"
          inert={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mx-1 mt-2 border-t border-slate-200 pb-1 pt-4 dark:border-slate-800">
              <div
                className={cn(
                  "grid gap-3 sm:grid-cols-2",
                  showMentor ? "lg:grid-cols-5" : "lg:grid-cols-4",
                )}
              >
                <label className={drawerLabelClass} htmlFor="issue-status">
                  Status
                  <select
                    className={drawerSelectClass}
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
                </label>

                <label className={drawerLabelClass} htmlFor="issue-sort">
                  Sort by
                  <select
                    className={drawerSelectClass}
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
                </label>

                <label className={drawerLabelClass}>
                  Course
                  <select
                    className={drawerSelectClass}
                    name="courseSlug"
                    onChange={(event) => patchDraft({ courseSlug: event.target.value })}
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

                <label className={drawerLabelClass}>
                  Batch
                  <select
                    className={drawerSelectClass}
                    name="batchNo"
                    onChange={(event) => patchDraft({ batchNo: event.target.value })}
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
                  <label className={drawerLabelClass}>
                    Mentor
                    <select
                      className={drawerSelectClass}
                      name="mentorId"
                      onChange={(event) => patchDraft({ mentorId: event.target.value })}
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
              </div>

              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <fieldset className="min-w-0 lg:max-w-xl lg:flex-1">
                  <legend className={cn(drawerLabelClass, "mb-1.5")}>Date range</legend>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="From date"
                      className={cn(drawerFieldClass, "min-w-0 flex-1")}
                      max={draft.to || undefined}
                      name="from"
                      onChange={(event) => patchDraft({ from: event.target.value })}
                      type="date"
                      value={draft.from}
                    />
                    <span aria-hidden="true" className="shrink-0 text-slate-400">
                      →
                    </span>
                    <input
                      aria-label="To date"
                      className={cn(drawerFieldClass, "min-w-0 flex-1")}
                      min={draft.from || undefined}
                      name="to"
                      onChange={(event) => patchDraft({ to: event.target.value })}
                      type="date"
                      value={draft.to}
                    />
                  </div>
                </fieldset>

                <div className="flex items-center justify-end gap-3">
                  {advancedCount > 0 && (
                    <Link
                      className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      href={clearFiltersHref}
                    >
                      Reset
                    </Link>
                  )}
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-primary-600 active:bg-primary-700 motion-safe:active:scale-[0.98]"
                    type="submit"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </form>

      {/*
        The result count and the active filters sit after the form, outside the
        sticky strip: they scroll away with the list instead of floating over
        cards, and a closed drawer never hides *why* the list is filtered.
      */}
      <div
        className={cn("flex flex-wrap items-center gap-2 px-1", !floating && "-mt-4")}
        data-testid="issue-list-summary"
      >
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
    </>
  );
}

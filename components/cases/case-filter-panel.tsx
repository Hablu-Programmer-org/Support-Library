"use client";

import { Button, Input } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";

import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { Panel } from "@/components/shared/panel";
import { nativeFieldClass, nativeLabelClass, nativeSelectClass } from "@/lib/config/fields";

const statusLabels: Record<string, string> = {
  OPEN: "ওপেন",
  SOLVED: "সলভড",
  PENDING: "পেন্ডিং",
  FOLLOW_UP: "ফলো-আপ",
  ARCHIVED: "আর্কাইভড",
};

const CASE_SORTS = ["newest", "oldest", "priority"] as const;
export type CaseSort = (typeof CASE_SORTS)[number];

const sortLabels: Record<CaseSort, string> = {
  newest: "নতুন আগে",
  oldest: "পুরনো আগে",
  priority: "Priority",
};

export type CaseFilterDefaults = {
  q: string;
  tag: string;
  status: string;
  courseSlug: string;
  batchNo: string;
  mentorId: string;
  dateFrom: string;
  dateTo: string;
  sort: CaseSort;
};

type CaseFilterPanelProps = {
  defaults: CaseFilterDefaults;
  statuses: readonly string[];
  courseSlugs: string[];
  batchNos: number[];
  mentors: { id: string; name: string }[];
};

export function CaseFilterPanel({ defaults, statuses, courseSlugs, batchNos, mentors }: CaseFilterPanelProps) {
  const activeCount = [
    defaults.q,
    defaults.tag,
    defaults.status,
    defaults.courseSlug,
    defaults.batchNo,
    defaults.mentorId,
    defaults.dateFrom,
    defaults.dateTo,
  ].filter(Boolean).length;
  // A non-default sort also counts as "in use", so applying only a sort keeps
  // the panel open instead of collapsing the controls the user just set.
  const [open, setOpen] = useState(activeCount > 0 || defaults.sort !== "newest");

  return (
    <Panel>
      <form action="/dashboard/cases" method="get" className="space-y-4">
        <Input
          defaultValue={defaults.q}
          endContent={
            <button
              aria-expanded={open}
              aria-label="Advanced filters"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              <ChevronDownIcon
                className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                size={18}
              />
            </button>
          }
          name="q"
          placeholder="সমস্যা, student বা text দিয়ে খুঁজুন"
          startContent={<SearchIcon className="text-slate-400" size={18} />}
        />

        {open && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className={nativeLabelClass}>
                Tag
                <input className={nativeFieldClass} defaultValue={defaults.tag} name="tag" />
              </label>

              <label className={nativeLabelClass}>
                সাজান
                <select className={nativeSelectClass} defaultValue={defaults.sort} name="sort">
                  {CASE_SORTS.map((item) => (
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
                <select className={nativeSelectClass} defaultValue={defaults.status} name="status">
                  <option value="">সব</option>
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {statusLabels[item] ?? item}
                    </option>
                  ))}
                </select>
              </label>

              <label className={nativeLabelClass}>
                Course
                <select className={nativeSelectClass} defaultValue={defaults.courseSlug} name="courseSlug">
                  <option value="">সব</option>
                  {courseSlugs.map((slug) => (
                    <option key={slug} value={slug}>
                      {slug}
                    </option>
                  ))}
                </select>
              </label>

              <label className={nativeLabelClass}>
                Batch
                <select className={nativeSelectClass} defaultValue={defaults.batchNo} name="batchNo">
                  <option value="">সব</option>
                  {batchNos.map((batch) => (
                    <option key={batch} value={String(batch)}>
                      {batch}
                    </option>
                  ))}
                </select>
              </label>

              <label className={nativeLabelClass}>
                Mentor
                <select className={nativeSelectClass} defaultValue={defaults.mentorId} name="mentorId">
                  <option value="">সব</option>
                  {mentors.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={nativeLabelClass}>
                তারিখ থেকে
                <input className={nativeFieldClass} defaultValue={defaults.dateFrom} name="from" type="date" />
              </label>

              <label className={nativeLabelClass}>
                তারিখ পর্যন্ত
                <input className={nativeFieldClass} defaultValue={defaults.dateTo} name="to" type="date" />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {activeCount > 0 ? `সক্রিয় ফিল্টার: ${activeCount}` : ""}
              </span>
              <div className="flex gap-2">
                <Button as={Link} href="/dashboard/cases" size="sm" variant="light">
                  রিসেট
                </Button>
                <Button color="primary" size="sm" type="submit" variant="flat">
                  ফিল্টার
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </Panel>
  );
}

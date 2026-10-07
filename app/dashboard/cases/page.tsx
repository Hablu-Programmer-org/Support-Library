import { Button, Card, CardBody, Input } from "@heroui/react";
import Link from "next/link";

import { StatusBadge } from "@/components/cases/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { nativeFieldClass, nativeLabelClass } from "@/lib/config/fields";
import { canMutate } from "@/lib/roles";
import { listCaseFilterOptions, listCases } from "@/lib/services/cases";
import { listStaff } from "@/lib/services/staff";
import { CASE_STATUSES } from "@/models";

export const dynamic = "force-dynamic";

const statusLabels = {
  OPEN: "ওপেন",
  SOLVED: "সলভড",
  PENDING: "পেন্ডিং",
  FOLLOW_UP: "ফলো-আপ",
  ARCHIVED: "আর্কাইভড",
};

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    status?: string;
    tag?: string;
    courseSlug?: string;
    batchNo?: string;
    mentorId?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}) {
  const session = await requireSession();
  const page = Number(searchParams?.page ?? "1");

  // The filter schema expects ISO datetimes, but a date input yields YYYY-MM-DD.
  // `from` starts at midnight, `to` ends at end-of-day, both in UTC.
  const from = searchParams?.from ? `${searchParams.from}T00:00:00.000Z` : undefined;
  const to = searchParams?.to ? `${searchParams.to}T23:59:59.999Z` : undefined;

  const cases = await listCases({
    q: searchParams?.q,
    status: CASE_STATUSES.includes(searchParams?.status as never) ? searchParams?.status as never : undefined,
    tag: searchParams?.tag,
    courseSlug: searchParams?.courseSlug || undefined,
    batchNo: searchParams?.batchNo ? Number(searchParams.batchNo) : undefined,
    mentorId: searchParams?.mentorId || undefined,
    from,
    to,
    page,
    limit: 20,
  });

  const [{ courseSlugs, batchNos }, staff] = await Promise.all([
    listCaseFilterOptions(),
    listStaff(),
  ]);
  const mentors = staff.filter((member) => member.isActive && (member.role === "MENTOR" || member.role === "ADMIN"));

  const canCreate = Boolean(session.user.role && canMutate(session.user.role));
  const q = searchParams?.q ?? "";
  const tag = searchParams?.tag ?? "";
  const status = searchParams?.status ?? "";
  const courseSlug = searchParams?.courseSlug ?? "";
  const batchNo = searchParams?.batchNo ?? "";
  const mentorId = searchParams?.mentorId ?? "";
  const dateFrom = searchParams?.from ?? "";
  const dateTo = searchParams?.to ?? "";

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (tag) params.set("tag", tag);
    if (courseSlug) params.set("courseSlug", courseSlug);
    if (batchNo) params.set("batchNo", batchNo);
    if (mentorId) params.set("mentorId", mentorId);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", String(nextPage));
    return `/dashboard/cases?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          canCreate && (
            <Button as={Link} color="primary" href="/dashboard/cases/new">
              নতুন কেস
            </Button>
          )
        }
        description="সমস্যা, tag, status বা text দিয়ে পুরনো support case খুঁজুন।"
        title="সাপোর্ট কেস"
      />

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardBody>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Input name="q" label="সার্চ" defaultValue={q} />
            <Input name="tag" label="Tag" defaultValue={tag} />

            <label className={nativeLabelClass}>
              Status
              <select
                name="status"
                defaultValue={status}
                className={nativeFieldClass}
              >
                <option value="">সব</option>
                {CASE_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {statusLabels[item]}
                  </option>
                ))}
              </select>
            </label>

            <label className={nativeLabelClass}>
              Course
              <select
                name="courseSlug"
                defaultValue={courseSlug}
                className={nativeFieldClass}
              >
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
              <select
                name="batchNo"
                defaultValue={batchNo}
                className={nativeFieldClass}
              >
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
              <select
                name="mentorId"
                defaultValue={mentorId}
                className={nativeFieldClass}
              >
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
              <input
                type="date"
                name="from"
                defaultValue={dateFrom}
                className={nativeFieldClass}
              />
            </label>

            <label className={nativeLabelClass}>
              তারিখ পর্যন্ত
              <input
                type="date"
                name="to"
                defaultValue={dateTo}
                className={nativeFieldClass}
              />
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" color="primary" variant="flat" className="w-full">
                ফিল্টার
              </Button>
              <Button as={Link} href="/dashboard/cases" variant="light" className="w-full">
                রিসেট
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardBody className="p-0">
          {cases.items.length === 0 ? (
            <EmptyState>কোনো কেস পাওয়া যায়নি।</EmptyState>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {cases.items.map((supportCase) => (
                <Link
                  key={supportCase.id}
                  href={`/dashboard/cases/${supportCase.id}`}
                  className="block p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{supportCase.title}</h2>
                        <StatusBadge status={supportCase.status} />
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{supportCase.question}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {supportCase.studentName ?? "Unknown student"}
                        {supportCase.studentId ? ` · ${supportCase.studentId}` : ""}
                      </p>
                    </div>
                    {supportCase.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:max-w-xs sm:justify-end">
                        {supportCase.tags.map((item) => (
                          <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          পেজ {cases.page} / {cases.totalPages} · মোট {cases.total}
        </span>
        <div className="flex gap-2">
          {cases.page > 1 && (
            <Button as={Link} href={pageHref(cases.page - 1)} size="sm" variant="flat">
              আগের
            </Button>
          )}
          {cases.page < cases.totalPages && (
            <Button as={Link} href={pageHref(cases.page + 1)} size="sm" variant="flat">
              পরের
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

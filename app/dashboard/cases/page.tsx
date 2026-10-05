import { Button, Card, CardBody, Input } from "@heroui/react";
import Link from "next/link";

import { StatusBadge } from "@/components/cases/status-badge";
import { requireSession } from "@/lib/auth-guard";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">সাপোর্ট কেস</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">সমস্যা, tag, status বা text দিয়ে পুরনো support case খুঁজুন।</p>
        </div>
        {canCreate && (
          <Button as={Link} href="/dashboard/cases/new" color="primary">
            নতুন কেস
          </Button>
        )}
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Input name="q" label="সার্চ" defaultValue={q} />
            <Input name="tag" label="Tag" defaultValue={tag} />

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              Status
              <select
                name="status"
                defaultValue={status}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">সব</option>
                {CASE_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {statusLabels[item]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              Course
              <select
                name="courseSlug"
                defaultValue={courseSlug}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">সব</option>
                {courseSlugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {slug}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              Batch
              <select
                name="batchNo"
                defaultValue={batchNo}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">সব</option>
                {batchNos.map((batch) => (
                  <option key={batch} value={String(batch)}>
                    {batch}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              Mentor
              <select
                name="mentorId"
                defaultValue={mentorId}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">সব</option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              তারিখ থেকে
              <input
                type="date"
                name="from"
                defaultValue={dateFrom}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              তারিখ পর্যন্ত
              <input
                type="date"
                name="to"
                defaultValue={dateTo}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
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

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="p-0">
          {cases.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">কোনো কেস পাওয়া যায়নি।</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {cases.items.map((supportCase) => (
                <Link
                  key={supportCase.id}
                  href={`/dashboard/cases/${supportCase.id}`}
                  className="block p-4 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{supportCase.title}</h2>
                        <StatusBadge status={supportCase.status} />
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{supportCase.question}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {supportCase.studentName ?? "Unknown student"}
                        {supportCase.studentId ? ` · ${supportCase.studentId}` : ""}
                      </p>
                    </div>
                    {supportCase.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:max-w-xs sm:justify-end">
                        {supportCase.tags.map((item) => (
                          <span key={item} className="rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
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

      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
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

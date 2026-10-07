import { Button, Card, CardBody, Input } from "@heroui/react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { listStudents } from "@/lib/services/students";
import { canMutate } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const session = await requireSession();
  const q = searchParams?.q ?? "";
  const page = Number(searchParams?.page ?? "1");
  const students = await listStudents({ q, page, limit: 20 });
  const canCreate = Boolean(session.user.role && canMutate(session.user.role));

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          canCreate && (
            <Button as={Link} color="primary" href="/dashboard/students/new">
              নতুন স্টুডেন্ট
            </Button>
          )
        }
        description="নাম, ইমেইল, ফোন, স্টুডেন্ট আইডি বা LMS ID দিয়ে খুঁজুন।"
        title="স্টুডেন্ট"
      />

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardBody>
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input className="flex-1" defaultValue={q} label="সার্চ" name="q" />
            <Button color="primary" type="submit" variant="flat">
              খুঁজুন
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardBody className="p-0">
          {students.items.length === 0 ? (
            <EmptyState>কোনো স্টুডেন্ট পাওয়া যায়নি।</EmptyState>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {students.items.map((student) => (
                <Link
                  key={student.id}
                  className="block p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  href={`/dashboard/students/${student.id}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold">{student.name}</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {[student.studentId, student.email, student.phone].filter(Boolean).join(" · ") || "আইডি/যোগাযোগ নেই"}
                      </p>
                    </div>
                    {student.lmsUserId && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">LMS: {student.lmsUserId}</span>
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
          পেজ {students.page} / {students.totalPages} · মোট {students.total}
        </span>
        <div className="flex gap-2">
          {students.page > 1 && (
            <Button as={Link} href={`/dashboard/students?q=${encodeURIComponent(q)}&page=${students.page - 1}`} size="sm" variant="flat">
              আগের
            </Button>
          )}
          {students.page < students.totalPages && (
            <Button as={Link} href={`/dashboard/students?q=${encodeURIComponent(q)}&page=${students.page + 1}`} size="sm" variant="flat">
              পরের
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

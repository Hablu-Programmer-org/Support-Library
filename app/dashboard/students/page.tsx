import { Button, Card, CardBody, Input } from "@heroui/react";
import Link from "next/link";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">স্টুডেন্ট</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            নাম, ইমেইল, ফোন, স্টুডেন্ট আইডি বা LMS ID দিয়ে খুঁজুন।
          </p>
        </div>
        {canCreate && (
          <Button as={Link} href="/dashboard/students/new" color="primary">
            নতুন স্টুডেন্ট
          </Button>
        )}
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody>
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input name="q" label="সার্চ" defaultValue={q} className="flex-1" />
            <Button type="submit" color="primary" variant="flat">
              খুঁজুন
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="p-0">
          {students.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">কোনো স্টুডেন্ট পাওয়া যায়নি।</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {students.items.map((student) => (
                <Link
                  key={student.id}
                  href={`/dashboard/students/${student.id}`}
                  className="block p-4 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold">{student.name}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {[student.studentId, student.email, student.phone].filter(Boolean).join(" · ") || "আইডি/যোগাযোগ নেই"}
                      </p>
                    </div>
                    {student.lmsUserId && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">LMS: {student.lmsUserId}</span>
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

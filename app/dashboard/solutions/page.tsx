import { Button, Card, CardBody, Chip, Input } from "@heroui/react";
import Link from "next/link";

import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";
import { listSolutions } from "@/lib/services/solutions";

export const dynamic = "force-dynamic";

export default async function SolutionsPage({ searchParams }: { searchParams?: { q?: string; tag?: string; page?: string } }) {
  const session = await requireSession();
  const q = searchParams?.q ?? "";
  const tag = searchParams?.tag ?? "";
  const page = Number(searchParams?.page ?? "1");
  const solutions = await listSolutions({ q, tag, page, limit: 20 });
  const canCreate = Boolean(session.user.role && canMutate(session.user.role));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">সলিউশন লাইব্রেরি</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Reusable answers, links and video summaries.</p>
        </div>
        {canCreate && <Button as={Link} href="/dashboard/solutions/new" color="primary">নতুন সলিউশন</Button>}
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody>
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <Input name="q" label="সার্চ" defaultValue={q} />
            <Input name="tag" label="Tag" defaultValue={tag} />
            <div className="flex items-end">
              <Button type="submit" color="primary" variant="flat" className="w-full">খুঁজুন</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="p-0">
          {solutions.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">কোনো সলিউশন পাওয়া যায়নি।</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {solutions.items.map((solution) => (
                <Link key={solution.id} href={`/dashboard/solutions/${solution.slug}`} className="block p-4 transition hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{solution.title}</h2>
                        <Chip size="sm" variant="flat" color={solution.visibility === "PUBLIC" ? "success" : "default"}>{solution.visibility}</Chip>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{solution.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:max-w-xs sm:justify-end">
                      {solution.tags.map((item) => <span key={item} className="rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{item}</span>)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

import { Button, Card, CardBody, Chip, Input } from "@heroui/react";
import Link from "next/link";

import { requireSession } from "@/lib/auth-guard";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
      <PageHeader
        action={
          canCreate && (
            <Button as={Link} color="primary" href="/dashboard/solutions/new">
              নতুন সলিউশন
            </Button>
          )
        }
        description="Reusable answers, links and video summaries."
        title="সলিউশন লাইব্রেরি"
      />

      <Card className="border border-slate-200 dark:border-slate-700">
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

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardBody className="p-0">
          {solutions.items.length === 0 ? (
            <EmptyState>কোনো সলিউশন পাওয়া যায়নি।</EmptyState>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {solutions.items.map((solution) => (
                <Link key={solution.id} href={`/dashboard/solutions/${solution.slug}`} className="block p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{solution.title}</h2>
                        <Chip size="sm" variant="flat" color={solution.visibility === "PUBLIC" ? "success" : "default"}>{solution.visibility}</Chip>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{solution.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:max-w-xs sm:justify-end">
                      {solution.tags.map((item) => <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{item}</span>)}
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

import { Card, CardBody, CardHeader, Chip, Input, Button } from "@heroui/react";
import Link from "next/link";

import { StatusBadge } from "@/components/cases/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { listCases } from "@/lib/services/cases";
import { listSolutions } from "@/lib/services/solutions";

export const dynamic = "force-dynamic";

const suggestions = [
  "image show hocche na",
  "ছবি দেখাচ্ছে না",
  "image not rendering",
  "useEffect api call loop",
];

export default async function SearchPage({ searchParams }: { searchParams?: { q?: string } }) {
  await requireSession();
  const q = searchParams?.q ?? "";
  const [cases, solutions] = q.trim().length >= 2
    ? await Promise.all([
        listCases({ q, limit: 8 }),
        listSolutions({ q, limit: 8 }),
      ])
    : [{ items: [] }, { items: [] }];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Case, answer text, solution body, tags এবং Bangla/English/Banglish keyword দিয়ে খুঁজুন।"
        title="গ্লোবাল সার্চ"
      />

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardBody className="space-y-4">
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input name="q" label="Search keyword" defaultValue={q} className="flex-1" autoFocus />
            <Button type="submit" color="primary">খুঁজুন</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <Button key={item} as={Link} href={`/dashboard/search?q=${encodeURIComponent(item)}`} size="sm" variant="flat">
                {item}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      {!q.trim() || q.trim().length < 2 ? (
        <Card className="border border-slate-200 dark:border-slate-700">
          <CardBody className="text-sm text-slate-500 dark:text-slate-400">
            কমপক্ষে ২ অক্ষর লিখে search করুন।
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardHeader className="font-semibold">Matching Cases</CardHeader>
            <CardBody className="space-y-3">
              {cases.items.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">কোনো case পাওয়া যায়নি।</p>
              ) : cases.items.map((supportCase) => (
                <Link key={supportCase.id} href={`/dashboard/cases/${supportCase.id}`} className="block rounded-xl border border-slate-200 p-3 transition hover:border-primary dark:border-slate-700">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-primary">{supportCase.title}</span>
                    <StatusBadge status={supportCase.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{supportCase.question}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{supportCase.studentName ?? "Unknown student"}</p>
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-700">
            <CardHeader className="font-semibold">Matching Solutions</CardHeader>
            <CardBody className="space-y-3">
              {solutions.items.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">কোনো solution পাওয়া যায়নি।</p>
              ) : solutions.items.map((solution) => (
                <Link key={solution.id} href={`/dashboard/solutions/${solution.slug}`} className="block rounded-xl border border-slate-200 p-3 transition hover:border-primary dark:border-slate-700">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-primary">{solution.title}</span>
                    <Chip size="sm" variant="flat" color={solution.visibility === "PUBLIC" ? "success" : "default"}>{solution.visibility}</Chip>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{solution.summary}</p>
                </Link>
              ))}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteSolutionAction, publishSolutionAction } from "@/actions/solutions";
import { SolutionForm } from "@/components/solutions/solution-form";
import { LinkList } from "@/components/shared/link-list";
import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";
import { listCasesForSolution } from "@/lib/services/links";
import { getSolutionBySlug } from "@/lib/services/solutions";

export const dynamic = "force-dynamic";

export default async function SolutionDetailPage({ params }: { params: { slug: string } }) {
  const session = await requireSession();
  const solution = await getSolutionBySlug(params.slug);
  if (!solution) notFound();
  const linkedCases = await listCasesForSolution(solution.id);

  const canEdit = Boolean(session.user.role && canMutate(session.user.role));
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/solutions" className="text-sm text-primary hover:underline">← সলিউশন লিস্টে ফিরে যান</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{solution.title}</h1>
            <Chip size="sm" variant="flat" color={solution.visibility === "PUBLIC" ? "success" : "default"}>{solution.visibility}</Chip>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">/{solution.slug}</p>
        </div>
        {isAdmin && solution.visibility !== "PUBLIC" && (
          <form action={publishSolutionAction.bind(null, solution.slug)}>
            <Button type="submit" color="success" variant="flat">Public করুন</Button>
          </form>
        )}
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="font-semibold">সলিউশন</CardHeader>
        <CardBody className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">{solution.summary}</p>
          <div className="flex flex-wrap gap-2">
            {solution.tags.map((tag) => <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{tag}</span>)}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-200">{solution.body}</p>
          <LinkList fileLinks={solution.fileLinks} videoLinks={solution.videoLinks} />
        </CardBody>
      </Card>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="font-semibold">Linked Cases</CardHeader>
        <CardBody>
          {linkedCases.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">এই solution এখনো কোনো case-এর সাথে linked না।</p>
          ) : (
            <div className="space-y-2">
              {linkedCases.map((supportCase) => (
                <Link
                  key={supportCase.id}
                  href={`/dashboard/cases/${supportCase.id}`}
                  className="block rounded-xl border border-gray-200 p-3 transition hover:border-primary dark:border-gray-700"
                >
                  <div className="font-medium text-primary">{supportCase.title}</div>
                  <div className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{supportCase.question}</div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {canEdit && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">সলিউশন এডিট</h2>
          <SolutionForm solution={solution} canPublish={isAdmin} />
          <form action={deleteSolutionAction.bind(null, solution.slug)}>
            <Button type="submit" color="danger" variant="flat">সলিউশন আর্কাইভ করুন</Button>
          </form>
        </section>
      )}
    </div>
  );
}

import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";

import { linkSolutionAction, unlinkSolutionAction } from "@/actions/links";
import { nativeSelectClass } from "@/lib/config/fields";
import type { SolutionListItem } from "@/lib/services/solutions";

export function LinkSolutionPanel({
  caseId,
  linkedSolutions,
  allSolutions,
  canMutate,
}: {
  caseId: string;
  linkedSolutions: SolutionListItem[];
  allSolutions: SolutionListItem[];
  canMutate: boolean;
}) {
  const linkedIds = new Set(linkedSolutions.map((solution) => solution.id));
  const available = allSolutions.filter((solution) => !linkedIds.has(solution.id));

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardHeader className="font-semibold">Linked Solutions</CardHeader>
      <CardBody className="space-y-4">
        {linkedSolutions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">এই কেসে কোনো solution linked নেই।</p>
        ) : (
          <div className="space-y-2">
            {linkedSolutions.map((solution) => (
              <div key={solution.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/dashboard/solutions/${solution.slug}`} className="font-medium text-primary hover:underline">
                    {solution.title}
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{solution.summary}</p>
                </div>
                {canMutate && (
                  <form action={unlinkSolutionAction.bind(null, caseId, solution.id)}>
                    <Button type="submit" size="sm" variant="light" color="danger">Unlink</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        {canMutate && (
          <form action={linkSolutionAction.bind(null, caseId)} className="flex flex-col gap-3 sm:flex-row">
            <select
              name="solutionArticleId"
              required
              className={`${nativeSelectClass} flex-1`}
              defaultValue=""
            >
              <option value="" disabled>Solution select করুন</option>
              {available.map((solution) => (
                <option key={solution.id} value={solution.id}>{solution.title}</option>
              ))}
            </select>
            <Button type="submit" color="primary" variant="flat" isDisabled={available.length === 0}>Link</Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

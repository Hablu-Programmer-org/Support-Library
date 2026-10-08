import { Button, Card, CardBody } from "@heroui/react";
import { Input, Textarea } from "@heroui/react";

import { createCaseAction, updateCaseAction } from "@/actions/cases";
import { StudentFields } from "@/components/cases/student-fields";
import { nativeSelectClass } from "@/lib/config/fields";
import type { SupportCaseListItem } from "@/lib/services/cases";
import { CASE_PRIORITIES, CASE_STATUSES } from "@/models";

type CaseFormProps = {
  supportCase?: SupportCaseListItem;
  minimal?: boolean;
};

const statusLabels = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const priorityLabels = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export function CaseForm({ supportCase, minimal = false }: CaseFormProps) {
  const action = supportCase ? updateCaseAction.bind(null, supportCase.id) : createCaseAction;

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardBody>
        <form action={action} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <StudentFields
              initialName={supportCase?.studentName}
              initialEmail={supportCase?.studentEmail ?? undefined}
              initialLmsUserId={supportCase?.lmsUserId}
              hideWhenFound={minimal}
            />

            {!minimal && (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Status <span className="text-danger">*</span>
                <select
                  name="status"
                  defaultValue={supportCase?.status ?? "OPEN"}
                  required
                  className={nativeSelectClass}
                >
                  {CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <Input name="title" label="Case Title" defaultValue={supportCase?.title} isRequired minLength={5} maxLength={200} />
          <Textarea
            name="question"
            label="Problem Description"
            defaultValue={supportCase?.question}
            isRequired
            minRows={6}
            maxLength={20_000}
          />

          {/* Solution section — only on create (minimal) */}
          {!supportCase && minimal && (
            <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-semibold">Answer (Optional)</summary>
              <div className="mt-4 space-y-4">
                <Textarea
                  name="solutionBody"
                  label="Answer"
                  minRows={4}
                  maxLength={20_000}
                  description="Add an answer if you have one. It will be saved as the first reply."
                />
                <Textarea
                  name="solutionFileLinks"
                  label="File Links (PDF/Images)"
                  description="One per line: title|https://url|type|note"
                  minRows={2}
                />
                <Textarea
                  name="solutionVideoLinks"
                  label="Video links"
                  description="One per line: title|https://url|timestamp|summary"
                  minRows={2}
                />
              </div>
            </details>
          )}

          {/* Solved checkbox — only on create (minimal) */}
          {!supportCase && minimal && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="solveCase" defaultChecked className="accent-cyan-500" />
                Mark as solved when an answer is provided
              </label>
            </div>
          )}

          {(
            <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-semibold">Additional Details</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input name="courseSlug" label="Course Slug" defaultValue={supportCase?.courseSlug ?? undefined} />
                <Input name="batchNo" label="Batch No" type="number" defaultValue={supportCase?.batchNo?.toString()} />
                <Input name="moduleSlug" label="Module Slug" />
                <Input name="contentSlug" label="Content/Lesson Slug" />
                <Input
                  name="tags"
                  label="Tags"
                  defaultValue={supportCase?.tags.join(", ")}
                  description="Separate with commas: react, image, api"
                />
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Priority
                  <select
                    name="priority"
                    defaultValue={supportCase?.priority ?? "NORMAL"}
                    className={nativeSelectClass}
                  >
                    {CASE_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priorityLabels[priority]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          )}

          <div className="flex justify-end">
            <Button type="submit" color="primary">
              {supportCase ? "Update Case" : "Create Case"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

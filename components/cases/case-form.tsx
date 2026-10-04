import { Button, Card, CardBody, Input, Textarea } from "@heroui/react";

import { createCaseAction, updateCaseAction } from "@/actions/cases";
import type { SupportCaseListItem } from "@/lib/services/cases";
import type { StudentListItem } from "@/lib/services/students";
import { CASE_PRIORITIES, CASE_STATUSES } from "@/models";

type CaseFormProps = {
  students: StudentListItem[];
  supportCase?: SupportCaseListItem;
  selectedStudentId?: string;
};

const statusLabels = {
  OPEN: "ওপেন",
  SOLVED: "সলভড",
  PENDING: "পেন্ডিং",
  FOLLOW_UP: "ফলো-আপ",
  ARCHIVED: "আর্কাইভড",
};

const priorityLabels = {
  LOW: "লো",
  NORMAL: "নরমাল",
  HIGH: "হাই",
  URGENT: "আর্জেন্ট",
};

export function CaseForm({ students, supportCase, selectedStudentId }: CaseFormProps) {
  const action = supportCase ? updateCaseAction.bind(null, supportCase.id) : createCaseAction;
  const studentValue = supportCase?.studentRefId ?? selectedStudentId ?? "";

  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardBody>
        <form action={action} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              স্টুডেন্ট <span className="text-danger">*</span>
              <select
                name="studentRefId"
                defaultValue={studentValue}
                required
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="" disabled>
                  স্টুডেন্ট নির্বাচন করুন
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} {student.studentId ? `(${student.studentId})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              স্ট্যাটাস <span className="text-danger">*</span>
              <select
                name="status"
                defaultValue={supportCase?.status ?? "OPEN"}
                required
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              >
                {CASE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Input name="title" label="সমস্যার টাইটেল" defaultValue={supportCase?.title} isRequired minLength={5} maxLength={200} />
          <Textarea
            name="question"
            label="সমস্যার বিস্তারিত"
            defaultValue={supportCase?.question}
            isRequired
            minRows={6}
            maxLength={20_000}
          />

          <details className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <summary className="cursor-pointer text-sm font-semibold">অপশনাল তথ্য</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input name="courseSlug" label="Course Slug" defaultValue={supportCase?.courseSlug ?? undefined} />
              <Input name="batchNo" label="Batch No" type="number" defaultValue={supportCase?.batchNo?.toString()} />
              <Input name="moduleSlug" label="Module Slug" />
              <Input name="contentSlug" label="Content/Lesson Slug" />
              <Input
                name="tags"
                label="Tags"
                defaultValue={supportCase?.tags.join(", ")}
                description="কমা দিয়ে আলাদা করুন: react, image, api"
              />
              <label className="flex flex-col gap-2 text-sm font-medium">
                Priority
                <select
                  name="priority"
                  defaultValue={supportCase?.priority ?? "NORMAL"}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
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

          <div className="flex justify-end">
            <Button type="submit" color="primary">
              {supportCase ? "কেস আপডেট করুন" : "কেস তৈরি করুন"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

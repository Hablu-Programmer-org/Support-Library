import { Button, Card, CardBody, Input } from "@heroui/react";

import { createStudentAction, updateStudentAction } from "@/actions/students";
import type { StudentListItem } from "@/lib/services/students";

type StudentFormProps = {
  student?: StudentListItem;
};

export function StudentForm({ student }: StudentFormProps) {
  const action = student ? updateStudentAction.bind(null, student.id) : createStudentAction;

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardBody>
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <Input
            name="name"
            label="নাম"
            defaultValue={student?.name}
            isRequired
            minLength={2}
            maxLength={120}
          />
          <Input
            name="studentId"
            label="স্টুডেন্ট আইডি"
            defaultValue={student?.studentId ?? undefined}
            description="Optional. একই নামের একাধিক student থাকতে পারে।"
          />
          <Input name="email" label="ইমেইল" type="email" defaultValue={student?.email ?? undefined} />
          <Input name="phone" label="ফোন" defaultValue={student?.phone ?? undefined} />
          <Input name="lmsUserId" label="LMS User ID" defaultValue={student?.lmsUserId ?? undefined} />
          <div className="flex items-end justify-end md:col-span-2">
            <Button color="primary" type="submit">
              {student ? "আপডেট করুন" : "স্টুডেন্ট যোগ করুন"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

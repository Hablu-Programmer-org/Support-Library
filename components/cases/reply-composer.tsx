import { Button, Card, CardBody, Textarea } from "@heroui/react";

import { addReplyAction } from "@/actions/replies";

export function ReplyComposer({ caseId }: { caseId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardBody>
          <form action={addReplyAction.bind(null, caseId)} className="space-y-3">
            <input type="hidden" name="isInternalNote" value="false" />
            <Textarea name="body" label="উত্তর লিখুন" minRows={4} isRequired maxLength={20_000} />
            <details className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-semibold">External file/video links</summary>
              <div className="mt-3 grid gap-3">
                <Textarea
                  name="fileLinks"
                  label="File links"
                  minRows={2}
                  description="প্রতি লাইনে: title|https://url|type|note"
                />
                <Textarea
                  name="videoLinks"
                  label="Video links"
                  minRows={2}
                  description="প্রতি লাইনে: title|https://url|timestamp|summary"
                />
              </div>
            </details>
            <div className="flex justify-end">
              <Button type="submit" color="primary">
                উত্তর যোগ করুন
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="border border-warning-200 bg-warning-50/50 dark:border-warning-900/40 dark:bg-warning-950/20">
        <CardBody>
          <form action={addReplyAction.bind(null, caseId)} className="space-y-3">
            <input type="hidden" name="isInternalNote" value="true" />
            <Textarea name="body" label="ইন্টারনাল নোট" minRows={4} isRequired maxLength={20_000} />
            <details className="rounded-2xl border border-warning-200 p-3 dark:border-warning-900/40">
              <summary className="cursor-pointer text-sm font-semibold">Internal links</summary>
              <div className="mt-3 grid gap-3">
                <Textarea name="fileLinks" label="File links" minRows={2} description="প্রতি লাইনে: title|https://url|type|note" />
                <Textarea name="videoLinks" label="Video links" minRows={2} description="প্রতি লাইনে: title|https://url|timestamp|summary" />
              </div>
            </details>
            <p className="text-xs text-warning-700 dark:text-warning-300">
              এই নোট শুধু staff দেখবে। ভবিষ্যৎ public/student output-এ যাবে না।
            </p>
            <div className="flex justify-end">
              <Button type="submit" color="warning" variant="flat">
                নোট যোগ করুন
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

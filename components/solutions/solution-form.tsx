import { Button, Card, CardBody, Input, Textarea } from "@heroui/react";

import { createSolutionAction, updateSolutionAction } from "@/actions/solutions";
import type { SolutionListItem } from "@/lib/services/solutions";

export function SolutionForm({ solution, canPublish = false }: { solution?: SolutionListItem; canPublish?: boolean }) {
  const action = solution ? updateSolutionAction.bind(null, solution.slug) : createSolutionAction;

  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardBody>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input name="title" label="টাইটেল" defaultValue={solution?.title} isRequired minLength={5} maxLength={200} />
            <Input name="slug" label="Slug" defaultValue={solution?.slug} description="খালি রাখলে title থেকে তৈরি হবে।" />
          </div>
          <Textarea name="summary" label="Summary" defaultValue={solution?.summary} isRequired minRows={2} maxLength={500} />
          <Textarea name="body" label="Step-by-step answer" defaultValue={solution?.body} isRequired minRows={10} maxLength={100_000} />
          <Input name="tags" label="Tags" defaultValue={solution?.tags.join(", ")} description="কমা দিয়ে আলাদা করুন।" />

          <div className="grid gap-4 md:grid-cols-2">
            <Textarea
              name="fileLinks"
              label="File links"
              defaultValue={solution?.fileLinks.map((link) => [link.title, link.url, link.type, link.note].filter(Boolean).join("|")).join("\n")}
              minRows={2}
              description="প্রতি লাইনে: title|https://url|type|note"
            />
            <Textarea
              name="videoLinks"
              label="Video links"
              defaultValue={solution?.videoLinks.map((link) => [link.title, link.url, link.timestamp, link.summary].filter(Boolean).join("|")).join("\n")}
              minRows={2}
              description="প্রতি লাইনে: title|https://url|timestamp|summary"
            />
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Visibility
            <select
              name="visibility"
              defaultValue={solution?.visibility ?? "INTERNAL"}
              disabled={!canPublish}
              className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="INTERNAL">Internal</option>
              <option value="PUBLIC">Public</option>
            </select>
            {!canPublish && <span className="text-xs text-gray-500">Public করার permission শুধু ADMIN-এর।</span>}
          </label>

          {!canPublish && <input type="hidden" name="visibility" value="INTERNAL" />}

          <div className="flex justify-end">
            <Button type="submit" color="primary">
              {solution ? "সলিউশন আপডেট করুন" : "সলিউশন তৈরি করুন"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

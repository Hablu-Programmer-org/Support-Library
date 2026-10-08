import { Button, Card, CardBody, Input, Textarea } from "@heroui/react";

import { createSolutionAction, updateSolutionAction } from "@/actions/solutions";
import { nativeSelectClass } from "@/lib/config/fields";
import type { SolutionListItem } from "@/lib/services/solutions";
import type { SolutionPrefill } from "@/lib/solution-prefill";

export function SolutionForm({
  solution,
  defaults,
  canPublish = false,
}: {
  solution?: SolutionListItem;
  defaults?: SolutionPrefill;
  canPublish?: boolean;
}) {
  const action = solution ? updateSolutionAction.bind(null, solution.slug) : createSolutionAction;

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardBody>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              name="title"
              label="টাইটেল"
              defaultValue={solution?.title ?? defaults?.title}
              isRequired
              minLength={5}
              maxLength={200}
            />
            <Input name="slug" label="Slug" defaultValue={solution?.slug} description="খালি রাখলে title থেকে তৈরি হবে।" />
          </div>
          <Textarea
            name="summary"
            label="Summary"
            defaultValue={solution?.summary ?? defaults?.summary}
            isRequired
            minRows={2}
            maxLength={500}
          />
          <Textarea
            name="body"
            label="Step-by-step answer"
            defaultValue={solution?.body ?? defaults?.body}
            isRequired
            minRows={10}
            maxLength={100_000}
          />
          <Input
            name="tags"
            label="Tags"
            defaultValue={solution ? solution.tags.join(", ") : defaults?.tags}
            description="কমা দিয়ে আলাদা করুন।"
          />

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
              className={nativeSelectClass}
            >
              <option value="INTERNAL">Internal</option>
              <option value="PUBLIC">Public</option>
            </select>
            {!canPublish && <span className="text-xs text-slate-500">Public করার permission শুধু ADMIN-এর।</span>}
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
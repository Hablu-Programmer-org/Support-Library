import type { SupportCaseListItem } from "@/lib/services/cases";
import type { SupportReplyListItem } from "@/lib/services/replies";

export type PublicCaseView = {
  id: string;
  title: string;
  question: string;
  status: SupportCaseListItem["status"];
  tags: string[];
  replies: Array<{
    id: string;
    body: string;
    fileLinks: SupportReplyListItem["fileLinks"];
    videoLinks: SupportReplyListItem["videoLinks"];
  }>;
};

export function toPublicCaseView(supportCase: SupportCaseListItem, replies: SupportReplyListItem[]): PublicCaseView {
  return {
    id: supportCase.id,
    title: supportCase.title,
    question: supportCase.question,
    status: supportCase.status,
    tags: supportCase.tags,
    replies: replies
      .filter((reply) => !reply.isInternalNote)
      .map((reply) => ({
        id: reply.id,
        body: reply.body,
        fileLinks: reply.fileLinks,
        videoLinks: reply.videoLinks,
      })),
  };
}

/**
 * Live write-path integration test for search indexing.
 *
 * The unit tests pin the pure builders (`buildSearchFieldUpdate`) and the E2E
 * specs pin the query path, but neither proves that the *service* write paths
 * refresh the denormalized text. This test does: create an issue, add a staff
 * reply whose unique token does not appear in the title/question, then assert
 * that `listIssues` finds it — and that deleting the reply removes it again.
 *
 * Gated by `SEARCH_WRITE_PATH_TEST=1` because it needs a real MongoDB
 * (replica set, for the create transaction). The default suite skips it.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The service write paths read `next/headers` for the audit context, which
// only exists inside a request scope. Provide a fixed context so the test can
// exercise the real transactions without a Next server.
vi.mock("@/lib/request-context", () => ({
  getRequestContext: async () => ({
    ip: "127.0.0.1",
    userAgent: "vitest",
    requestId: "search-write-path-test",
  }),
}));

import { dbConnect } from "@/lib/db";
import { createIssue, listIssues } from "@/lib/services/issues";
import { addReply, softDeleteReply } from "@/lib/services/replies";
import { SupportIssueModel, SupportReplyModel } from "@/models";

const RUN = process.env.SEARCH_WRITE_PATH_TEST === "1";

describe.skipIf(!RUN)("search write-path integration", () => {
  const marker = `searchwritepath${Date.now()}`;
  const token = `replytoken${marker}`;
  const actorId = new mongoose.Types.ObjectId().toString();
  const staffId = new mongoose.Types.ObjectId().toString();
  let issueId = "";
  let replyId = "";

  beforeAll(async () => {
    vi.stubEnv("SEARCH_ENGINE", "regex");
    await dbConnect();
  });

  afterAll(async () => {
    await dbConnect();
    if (issueId) {
      await SupportReplyModel.deleteMany({ issueId });
      await SupportIssueModel.deleteMany({ _id: issueId });
    }
    await mongoose.connection.close();
  });

  it("indexes a staff reply body on add and drops it on delete", async () => {
    const created = await createIssue(
      {
        title: `Write-path probe ${marker}`,
        question: "Does adding a reply make its body searchable?",
        videoLinks: [],
        tags: [],
        status: "OPEN",
        priority: "NORMAL",
      },
      actorId,
      "STUDENT",
      crypto.randomUUID(),
    );
    issueId = created.id;
    expect(issueId).toBeTruthy();

    // The reply token is not in the title/question, so nothing matches yet.
    const before = await listIssues({ q: token, sort: "relevance" });
    expect(before.items.some((item) => item.id === issueId)).toBe(false);

    const reply = await addReply(
      { issueId, body: `Try clearing the cache with ${token}.`, videoLinks: [] },
      staffId,
      crypto.randomUUID(),
      [],
      "MENTOR",
    );
    expect(reply?.id).toBeTruthy();
    replyId = reply!.id;

    const after = await listIssues({ q: token, sort: "relevance" });
    expect(after.items.some((item) => item.id === issueId)).toBe(true);

    const stored = await SupportIssueModel.findById(issueId)
      .select("searchText publicSearchText")
      .lean();
    expect(String(stored?.searchText ?? "")).toContain(token);
    // A published thread is not required for the staff text; the public text
    // does carry staff answers, so it must contain the token too.
    expect(String(stored?.publicSearchText ?? "")).toContain(token);

    await softDeleteReply(issueId, replyId, staffId, "MENTOR");

    const removed = await listIssues({ q: token, sort: "relevance" });
    expect(removed.items.some((item) => item.id === issueId)).toBe(false);
  }, 120_000);
});

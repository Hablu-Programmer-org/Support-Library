import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ReplyEditConflictError extends Error {}
  class UploadValidationError extends Error {
    constructor(readonly field: string, message: string) {
      super(message);
    }
  }
  return {
    ReplyEditConflictError,
    UploadValidationError,
    csrfTokenIsValid: vi.fn(async () => true),
    assertRole: vi.fn(async () => ({ ok: true, session: { user: { id: "staff-1", role: "MENTOR" } } })),
    consumeRateLimit: vi.fn(async () => undefined),
    ingestUploads: vi.fn(async (files: File[]) => files.map((file) => ({ _id: file.name, key: file.name }))),
    editReply: vi.fn(async () => ({ id: "reply-1" })),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/safe-action", () => ({ csrfTokenIsValid: mocks.csrfTokenIsValid }));
vi.mock("@/lib/auth-guard", () => ({ assertRole: mocks.assertRole }));
vi.mock("@/lib/services/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/services/issues", () => ({
  getIssueUrlRef: vi.fn(async (id: string) => ({ id, caseRef: null })),
}));
vi.mock("@/lib/request-context", () => ({ getRequestContext: vi.fn() }));
vi.mock("@/lib/services/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  MutationRateLimitError: class extends Error {},
  RateLimitUnavailableError: class extends Error {},
}));
vi.mock("@/lib/uploads/ingest", () => ({
  formFiles: (formData: FormData, key: string) =>
    formData.getAll(key).filter((value): value is File => value instanceof File && value.size > 0),
  ingestUploads: mocks.ingestUploads,
  UploadValidationError: mocks.UploadValidationError,
}));
vi.mock("@/lib/services/replies", () => ({
  addReply: vi.fn(),
  addStudentReply: vi.fn(),
  softDeleteReply: vi.fn(),
  editReply: mocks.editReply,
  ReplyEditConflictError: mocks.ReplyEditConflictError,
}));

import { editReplyAction } from "@/actions/replies";

const form = (fields: Record<string, string | File>) => {
  const data = new FormData();
  data.set("csrfToken", "csrf");
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("editReplyAction", () => {
  it("passes new images and the opened updatedAt to the service", async () => {
    const image = new File([new Uint8Array(8)], "shot.png", { type: "image/png" });
    const result = await editReplyAction(
      "issue-1",
      "reply-1",
      undefined,
      form({ body: "Fixed text", expectedUpdatedAt: "2026-11-01T00:00:00.000Z", uploads: image }),
    );

    expect(result).toEqual({ message: "Response updated." });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith("attachment.upload", "staff-1");
    const options = (mocks.editReply.mock.calls[0] as unknown[]).at(-1) as {
      newUploads: unknown[];
      expectedUpdatedAt: Date;
    };
    expect(options.newUploads).toHaveLength(1);
    expect(options.expectedUpdatedAt.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("skips the upload rate limit and ignores an unreadable updatedAt", async () => {
    await editReplyAction("issue-1", "reply-1", undefined, form({ body: "Text", expectedUpdatedAt: "nope" }));

    expect(mocks.consumeRateLimit).toHaveBeenCalledTimes(1);
    const options = (mocks.editReply.mock.calls[0] as unknown[]).at(-1) as { expectedUpdatedAt?: Date };
    expect(options.expectedUpdatedAt).toBeUndefined();
  });

  it("reports a concurrent edit instead of overwriting, and echoes the text", async () => {
    mocks.editReply.mockRejectedValueOnce(new mocks.ReplyEditConflictError());
    const result = await editReplyAction(
      "issue-1",
      "reply-1",
      undefined,
      form({ body: "My version", expectedUpdatedAt: "2026-11-01T00:00:00.000Z" }),
    );

    expect(result.fieldErrors?._form?.[0]).toMatch(/Someone else changed this reply/);
    expect(result.values?.body).toBe("My version");
  });

  it("maps a rejected image to the uploads field", async () => {
    mocks.editReply.mockRejectedValueOnce(
      new mocks.UploadValidationError("uploads", "This reply already has 5 image(s); you can add at most 0 more"),
    );
    const result = await editReplyAction("issue-1", "reply-1", undefined, form({ body: "Text" }));

    expect(result.fieldErrors?.uploads?.[0]).toMatch(/at most 0 more/);
  });
});

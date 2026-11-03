// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { dbConnect, findOne, countDocuments } = vi.hoisted(() => ({
  dbConnect: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ dbConnect: () => dbConnect() }));
vi.mock("@/models", () => ({ SupportIssueModel: { findOne, countDocuments } }));

import { getOwnIssueActivitySnapshot } from "@/lib/services/issue-activity";

const STUDENT = "6512f3a4b5c6d7e8f9a0b1c2";

function latestQueryResolves(latest: { updatedAt: Date } | null) {
  findOne.mockReturnValue({
    select: () => ({ sort: () => ({ lean: async () => latest }) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbConnect.mockResolvedValue(undefined);
  countDocuments.mockReturnValue({ maxTimeMS: async () => 0 });
});

describe("getOwnIssueActivitySnapshot", () => {
  it("refuses an id that is not an ObjectId without touching the database", async () => {
    const snapshot = await getOwnIssueActivitySnapshot("not-an-object-id");

    expect(snapshot).toEqual({ revision: "empty", count: 0 });
    expect(dbConnect).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
    expect(countDocuments).not.toHaveBeenCalled();
  });

  it("scopes both queries to the caller's own requests", async () => {
    latestQueryResolves({ updatedAt: new Date("2026-11-03T09:12:00.000Z") });
    countDocuments.mockReturnValue({ maxTimeMS: async () => 2 });

    const snapshot = await getOwnIssueActivitySnapshot(STUDENT);

    expect(snapshot).toEqual({ revision: "2026-11-03T09:12:00.000Z:2", count: 2 });

    const findOneFilter = findOne.mock.calls[0][0] as { createdBy: { toString(): string }; deletedAt: unknown };
    const countFilter = countDocuments.mock.calls[0][0] as { createdBy: { toString(): string }; deletedAt: unknown };

    // Ownership is `createdBy` = the authenticated student, and soft-deleted
    // cases are excluded — exactly the same scope as the list page.
    expect(String(findOneFilter.createdBy)).toBe(STUDENT);
    expect(String(countFilter.createdBy)).toBe(STUDENT);
    expect(findOneFilter.deletedAt).toBeNull();
    expect(countFilter.deletedAt).toBeNull();
    expect(findOneFilter).toEqual(countFilter);
  });

  it("returns the empty revision when the student has no requests", async () => {
    latestQueryResolves(null);
    countDocuments.mockReturnValue({ maxTimeMS: async () => 0 });

    const snapshot = await getOwnIssueActivitySnapshot(STUDENT);

    expect(snapshot).toEqual({ revision: "empty:0", count: 0 });
  });
});

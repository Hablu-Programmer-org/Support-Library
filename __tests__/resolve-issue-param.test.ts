// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { dbConnect, findOne } = vi.hoisted(() => ({
  dbConnect: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ dbConnect: () => dbConnect() }));
vi.mock("@/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/models")>()),
  SupportIssueModel: { findOne },
}));

import { getIssueUrlRef, resolveIssueIdFromParam } from "@/lib/services/issues";

const ID = "6512f3a4b5c6d7e8f9a0b1c2";

function lookupResolves(doc: Record<string, unknown> | null) {
  findOne.mockReturnValue({ lean: async () => doc });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbConnect.mockResolvedValue(undefined);
});

describe("resolveIssueIdFromParam", () => {
  it("returns an ObjectId key as-is without a query", async () => {
    await expect(resolveIssueIdFromParam(ID)).resolves.toBe(ID);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("maps a reference to the live issue's id", async () => {
    lookupResolves({ _id: ID });
    await expect(resolveIssueIdFromParam("000123")).resolves.toBe(ID);
    // Archived issues stay out: their reference must not open anything.
    expect(findOne).toHaveBeenCalledWith({ caseRef: "000123", deletedAt: null }, "_id");
  });

  it("returns null for an unknown reference", async () => {
    lookupResolves(null);
    await expect(resolveIssueIdFromParam("999999")).resolves.toBeNull();
  });

  it("refuses anything else without touching the database", async () => {
    for (const param of ["new", "12345", "1234567", "abc", "$where", `${ID}x`]) {
      await expect(resolveIssueIdFromParam(param)).resolves.toBeNull();
    }
    expect(findOne).not.toHaveBeenCalled();
    expect(dbConnect).not.toHaveBeenCalled();
  });
});

describe("getIssueUrlRef", () => {
  it("returns the reference for an id", async () => {
    lookupResolves({ _id: ID, caseRef: "000123" });
    await expect(getIssueUrlRef(ID)).resolves.toEqual({ id: ID, caseRef: "000123" });
  });

  it("falls back to no reference", async () => {
    lookupResolves(null);
    await expect(getIssueUrlRef(ID)).resolves.toEqual({ id: ID, caseRef: null });
    await expect(getIssueUrlRef("bad")).resolves.toEqual({ id: "bad", caseRef: null });
  });
});

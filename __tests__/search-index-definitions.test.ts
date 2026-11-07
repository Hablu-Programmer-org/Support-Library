/**
 * The committed Atlas index payloads are operational assets: `search:indexes:apply`
 * ships them verbatim, so an accidental staff-field mapping in the public
 * index would be a PII leak. Pin the isolation here, where the default suite
 * runs, instead of discovering it in production.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type IndexDefinition = {
  name: string;
  type: "search";
  definition: {
    analyzer: string;
    searchAnalyzer: string;
    dynamic: boolean;
    mappings: {
      dynamic: boolean;
      fields: Record<string, unknown>;
    };
  };
};

const loadIndex = (file: string): IndexDefinition =>
  JSON.parse(readFileSync(path.join(process.cwd(), "search/indexes", file), "utf8"));

const publicIndex = loadIndex("issues_public.json");
const staffIndex = loadIndex("issues_staff.json");

describe("Atlas index definitions", () => {
  it("uses Bengali analysis with dynamic mapping off on both indexes", () => {
    for (const index of [publicIndex, staffIndex]) {
      expect(index.type).toBe("search");
      expect(index.definition.analyzer).toBe("lucene.bengali");
      expect(index.definition.searchAnalyzer).toBe("lucene.bengali");
      expect(index.definition.dynamic).toBe(false);
      expect(index.definition.mappings.dynamic).toBe(false);
    }
  });

  it("gives both free-text fields a keyword raw sub-field for infix parity", () => {
    const publicFields = publicIndex.definition.mappings.fields;
    const staffFields = staffIndex.definition.mappings.fields;

    expect(publicFields.publicSearchText).toMatchObject({
      multi: { raw: { type: "string", analyzer: "lucene.keyword" } },
    });
    expect(staffFields.searchText).toMatchObject({
      multi: { raw: { type: "string", analyzer: "lucene.keyword" } },
    });
  });

  it("maps no staff-only field in the public index", () => {
    const fields = publicIndex.definition.mappings.fields;

    // A query-builder bug cannot leak what the index does not map.
    expect(fields).not.toHaveProperty("searchText");
    expect(fields).not.toHaveProperty("studentName");
    expect(fields).not.toHaveProperty("caseRef");
    expect(fields).not.toHaveProperty("mentorId");
    expect(fields).toHaveProperty("publicSearchText");
    expect(fields).toHaveProperty("batchNo");
  });

  it("maps the staff text, student name and mentor filter in the staff index", () => {
    const fields = staffIndex.definition.mappings.fields;

    expect(fields).toHaveProperty("searchText");
    expect(fields).toHaveProperty("studentName");
    expect(fields).toHaveProperty("mentorId");
    expect(fields).not.toHaveProperty("publicSearchText");
  });
});

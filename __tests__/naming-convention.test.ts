import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AuditEventModel,
  RateLimitBucketModel,
  SupportIssueModel,
  SupportReplyModel,
  UserModel,
} from "@/models";

/**
 * Model naming convention guard (ai-instructions.md §12).
 *
 * Every local MongoDB/Mongoose model must be **kebab-case** for its collection
 * name, its registered model name and its source file name. The external LMS
 * `User` collection (read through the raw driver in `lib/lms.ts`) belongs to
 * another system and is intentionally not part of this list.
 */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const localModels = [
  UserModel,
  SupportIssueModel,
  SupportReplyModel,
  AuditEventModel,
  RateLimitBucketModel,
];

describe("MongoDB model naming convention", () => {
  it("registers every local model with a kebab-case collection", () => {
    for (const model of localModels) {
      expect(model.collection.name, model.modelName).toMatch(KEBAB_CASE);
    }
  });

  it("registers every local model with a kebab-case model name", () => {
    for (const model of localModels) {
      expect(model.modelName).toMatch(KEBAB_CASE);
    }
  });

  it("has kebab-case model source file names", () => {
    const modelsDirectory = resolve(process.cwd(), "models");
    const files = readdirSync(modelsDirectory).filter((file) => file.endsWith(".ts"));

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(file.replace(/\.ts$/, "")).toMatch(KEBAB_CASE);
    }
  });
});

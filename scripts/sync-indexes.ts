import path from "node:path";

import dotenv from "dotenv";

import { dbConnect } from "../lib/db";
import {
  AuditEventModel,
  LiveSupportJoinModel,
  RateLimitBucketModel,
  SupportIssueModel,
  SupportReplyModel,
  UserModel,
} from "../models";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const models = [
  UserModel,
  SupportIssueModel,
  SupportReplyModel,
  LiveSupportJoinModel,
  AuditEventModel,
  RateLimitBucketModel,
];

async function main() {
  const apply = process.argv.includes("--apply");
  const createOnly = process.argv.includes("--create-only");
  const verify = process.argv.includes("--verify");
  if (verify && (apply || createOnly)) {
    throw new Error("Use --verify separately from --apply --create-only");
  }
  if (apply !== createOnly) {
    throw new Error("Use both --apply and --create-only to create missing indexes; the default is dry-run");
  }

  await dbConnect();

  for (const model of models) {
    const diff = await model.diffIndexes();
    console.info(`[db:indexes] ${model.modelName}`, {
      mode: apply ? "apply/create-only" : "dry-run",
      toCreate: diff.toCreate,
      wouldDropButWillNeverDrop: diff.toDrop,
    });

    if (apply && diff.toCreate.length > 0) {
      const created = await model.createIndexes();
      console.info(`[db:indexes] ${model.modelName} created`, created);
    }
    if (verify && diff.toCreate.length > 0) {
      throw new Error(`${model.modelName} is missing required indexes`);
    }
  }

  await process.exit(0);
}

main().catch((error) => {
  console.error("[db:indexes] failed", error);
  process.exit(1);
});

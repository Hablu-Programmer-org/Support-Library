import path from "path";

import dotenv from "dotenv";

import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const apply = process.argv.includes("--apply");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);

async function main() {
  await dbConnect();

  const databaseName = process.env.MONGODB_DB?.trim();
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }

  const filter = { visibility: { $exists: false } };
  const count = await SupportIssueModel.countDocuments(filter);

  console.info(`[issue-visibility] database: ${databaseName}`);
  console.info(`[issue-visibility] ${count} issue(s) require migration`);
  if (!apply) {
    console.info("[issue-visibility] dry run only; pass --apply to update records");
    process.exit(0);
  }

  const result = await SupportIssueModel.updateMany(filter, {
    $set: {
      visibility: "INTERNAL",
      publishedAt: null,
      publishedBy: null,
    },
  });
  console.info(`[issue-visibility] updated ${result.modifiedCount} issue(s)`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[issue-visibility] migration failed", error);
  process.exit(1);
});

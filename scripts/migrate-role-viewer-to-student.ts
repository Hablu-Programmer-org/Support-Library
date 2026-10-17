import path from "path";

import dotenv from "dotenv";

import { dbConnect } from "../lib/db";
import { UserModel } from "../models/user";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

/**
 * Renames the retired `VIEWER` role to `STUDENT`.
 *
 * The role itself did not change behaviour — students are still read-only on
 * published issues — but the app now also lets them submit a support issue, so
 * the name reflects the people it describes. Existing `staff-users` rows keep
 * the old string until this runs; `ROLE_RANK["VIEWER"]` is undefined, so those
 * rows silently lose their navigation until they are migrated.
 *
 * Dry run by default; `--apply` requires `--confirm=<MONGODB_DB>`.
 */
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

  const filter = { role: "VIEWER" };
  const count = await UserModel.countDocuments(filter);

  console.info(`[role-rename] database: ${databaseName}`);
  console.info(`[role-rename] ${count} user(s) still on the retired VIEWER role`);
  if (!apply) {
    console.info("[role-rename] dry run only; pass --apply to update records");
    process.exit(0);
  }

  const result = await UserModel.updateMany(filter, { $set: { role: "STUDENT" } });
  console.info(`[role-rename] updated ${result.modifiedCount} user(s)`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[role-rename] migration failed", error);
  process.exit(1);
});

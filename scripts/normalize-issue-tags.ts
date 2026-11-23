/**
 * Normalizes stored support-issue tags with the same rule new saves use
 * (`lib/issue-tags.ts`): no leading `#`, no trailing punctuation (incl. `।`),
 * lowercase, de-duplicated, empty entries dropped.
 *
 * Default mode is a dry run (read-only). Writing needs
 *   --apply --confirm=<MONGODB_DB>
 * and first writes a JSON backup of every row it will change
 * (`{ _id, before, after }`) to --backup-dir (default: ../scratchpad/migration-backups).
 * Rollback: --restore=<backup.json> --confirm=<MONGODB_DB>.
 *
 * Each write re-checks the row (`tags` must still equal the scanned value), so
 * a concurrent staff edit is skipped and reported instead of overwritten. Raw
 * driver writes leave `updatedAt` alone: it is the optimistic revision.
 * Re-running after apply reports `toChange=0`.
 *
 * `searchText`/`publicSearchText` embed the tags: run `npm run search:backfill`
 * (dry run, then --apply) afterwards.
 */
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { planTagNormalization } from "../lib/issue-tags";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const option = (name: string) =>
  argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);

const apply = flag("apply");
const asJson = flag("json");
const confirmation = option("confirm");
const restoreFile = option("restore");
const backupDir = path.resolve(
  process.cwd(),
  option("backup-dir") ?? "../scratchpad/migration-backups",
);
const BATCH = 200;
const SAMPLE = 25;

const log = (message: string) => {
  if (!asJson) console.info(`[normalize-issue-tags] ${message}`);
};

const redactMongoUri = (uri: string) =>
  uri.replace(/\/\/[^/@]+@/, "//***:***@").replace(/\?.*$/, "?<redacted>");

type BackupRow = { _id: string; before: unknown; after: string[] };

async function restore(collection: mongoose.mongo.Collection, file: string) {
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as BackupRow[];
  let restored = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(row._id), tags: row.after },
      { $set: { tags: row.before } },
    );
    if (result.modifiedCount === 1) restored += 1;
    else skipped += 1;
  }
  log(`restore: rows=${rows.length} restored=${restored} skipped(changed since)=${skipped}`);
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.MONGODB_DB?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  if (!databaseName) throw new Error("MONGODB_DB is required");
  const writes = apply || Boolean(restoreFile);
  if (writes && confirmation !== databaseName) {
    throw new Error(`Refusing to write: pass --confirm=${databaseName} to confirm the target database`);
  }

  log(`target=${redactMongoUri(uri)} database=${databaseName}`);
  log(`mode=${restoreFile ? "RESTORE" : apply ? "APPLY" : "DRY RUN"}`);

  await mongoose.connect(uri, { dbName: databaseName });
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB connection did not expose a database handle");
  const collection = database.collection("support-issues");

  if (restoreFile) {
    await restore(collection, path.resolve(process.cwd(), restoreFile));
    return;
  }

  const plan: BackupRow[] = [];
  const renames = new Map<string, number>();
  let scanned = 0;
  let dropped = 0;
  let cursor: mongoose.Types.ObjectId | null = null;

  for (;;) {
    const page = await collection
      .find(cursor ? { _id: { $gt: cursor } } : {}, { projection: { tags: 1 } })
      .sort({ _id: 1 })
      .limit(BATCH)
      .toArray();
    if (!page.length) break;

    for (const row of page) {
      scanned += 1;
      if (row.tags === undefined) continue; // the schema default fills it on read
      const result = planTagNormalization(row.tags);
      if (!result.changed) continue;
      dropped += result.dropped;
      plan.push({ _id: String(row._id), before: row.tags, after: result.next });
      const before = Array.isArray(row.tags) ? row.tags : [];
      for (const value of before) {
        const after = typeof value === "string" ? planTagNormalization([value]).next[0] ?? "∅" : "∅";
        if (value !== after) {
          const key = `${JSON.stringify(value)} → ${after}`;
          renames.set(key, (renames.get(key) ?? 0) + 1);
        }
      }
    }

    cursor = page.at(-1)?._id as mongoose.Types.ObjectId;
    if (page.length < BATCH) break;
  }

  const sample = [...renames.entries()].sort((a, b) => b[1] - a[1]).slice(0, SAMPLE);
  const summary = { database: databaseName, scanned, toChange: plan.length, droppedEntries: dropped };

  let modified = 0;
  let conflicts = 0;
  let backupPath: string | null = null;
  if (apply && plan.length) {
    fs.mkdirSync(backupDir, { recursive: true });
    backupPath = path.join(
      backupDir,
      `issue-tags-${databaseName}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.writeFileSync(backupPath, JSON.stringify(plan, null, 2));
    log(`backup written: ${backupPath} (${plan.length} rows)`);

    for (const row of plan) {
      const result = await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(row._id), tags: row.before },
        { $set: { tags: row.after } },
      );
      if (result.modifiedCount === 1) modified += 1;
      else conflicts += 1;
    }
  }

  if (asJson) {
    console.info(JSON.stringify({ ...summary, modified, conflicts, backupPath, renames: sample }, null, 2));
    return;
  }

  log(`scanned=${scanned} toChange=${plan.length} droppedEntries=${dropped}`);
  for (const [rename, count] of sample) log(`  ${rename}  ×${count}`);
  if (renames.size > SAMPLE) log(`  … ${renames.size - SAMPLE} more distinct renames`);
  if (apply) {
    log(`modified=${modified} conflicts(skipped, changed since scan)=${conflicts}`);
    if (backupPath) {
      log(`rollback: npx tsx scripts/normalize-issue-tags.ts --restore=${backupPath} --confirm=${databaseName}`);
    }
    log("next: npm run search:backfill (dry run), then with --apply");
  } else {
    log(`dry run only; to write: npm run db:normalize-issue-tags -- --apply --confirm=${databaseName}`);
  }
}

main()
  .catch((error) => {
    console.error("[normalize-issue-tags] fatal", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

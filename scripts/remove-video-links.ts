/**
 * Retires the `videoLinks` field from support issues and replies.
 *
 * Each document's links are appended to its text (`question` for issues, `body`
 * for replies) as a Markdown list, then the field is unset — in one update, so a
 * document is either fully migrated or untouched. Re-running is safe: migrated
 * documents no longer match `{ videoLinks: { $exists: true } }`.
 *
 * Default mode is dry-run. Apply requires `--apply --confirm=<MONGODB_DB>
 * --backup-acknowledged`. `--json` prints the summary as JSON.
 *
 * Writes go through the raw collection, so `updatedAt` is not bumped (it drives
 * queue order and the optimistic edit revision). Afterwards, rebuild the search
 * fields with `npm run search:backfill -- --apply --confirm=<MONGODB_DB>`.
 *
 * Rollback: restore the pre-apply mongodump of `support-issues` and
 * `support-replies`.
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { planVideoLinksFold } from "../lib/video-links-migration";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const apply = process.argv.includes("--apply");
const json = process.argv.includes("--json");
const backupAcknowledged = process.argv.includes("--backup-acknowledged");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);

const BATCH = 200;
const SAMPLE_LIMIT = 3;
const TAG = "[remove-video-links]";

type Report = {
  label: string;
  matched: number;
  folded: number;
  unsetOnly: number;
  linksMoved: number;
  droppedLinks: number;
  tooLong: string[];
  conflicts: string[];
  modified: number;
  samples: Array<{ id: string; appended: string }>;
};

function redactMongoUri(uri: string) {
  return uri.replace(/\/\/[^/@]+@/, "//***:***@").replace(/\?.*$/, "?<redacted>");
}

const log = (message: string) => {
  if (!json) console.info(`${TAG} ${message}`);
};

async function migrate(
  label: string,
  collection: mongoose.mongo.Collection,
  textField: "question" | "body",
): Promise<Report> {
  const report: Report = {
    label,
    matched: 0,
    folded: 0,
    unsetOnly: 0,
    linksMoved: 0,
    droppedLinks: 0,
    tooLong: [],
    conflicts: [],
    modified: 0,
    samples: [],
  };
  let cursor: unknown = null;

  for (;;) {
    const filter: Record<string, unknown> = { videoLinks: { $exists: true } };
    if (cursor) filter._id = { $gt: cursor };
    const batch = await collection
      .find(filter, { projection: { _id: 1, [textField]: 1, videoLinks: 1 } })
      .sort({ _id: 1 })
      .limit(BATCH)
      .toArray();
    if (!batch.length) break;

    for (const doc of batch) {
      report.matched += 1;
      const id = String(doc._id);
      const plan = planVideoLinksFold(doc[textField], doc.videoLinks);

      if (plan.kind === "too-long") {
        report.tooLong.push(`${id} (${plan.length} chars)`);
        continue;
      }

      let update: Record<string, unknown>;
      if (plan.kind === "unset-only") {
        report.unsetOnly += 1;
        report.droppedLinks += plan.droppedLinks;
        update = { $unset: { videoLinks: "" } };
      } else {
        report.folded += 1;
        report.linksMoved += plan.links;
        report.droppedLinks += plan.droppedLinks;
        if (report.samples.length < SAMPLE_LIMIT) report.samples.push({ id, appended: plan.appended });
        update = { $set: { [textField]: plan.text }, $unset: { videoLinks: "" } };
      }

      if (!apply) continue;
      // Re-check state: only write if neither field changed since it was read.
      const result = await collection.updateOne(
        { _id: doc._id, [textField]: doc[textField], videoLinks: doc.videoLinks },
        update,
      );
      if (result.modifiedCount === 1) report.modified += 1;
      else report.conflicts.push(id);
    }

    cursor = batch[batch.length - 1]._id;
    if (batch.length < BATCH) break;
  }

  return report;
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.MONGODB_DB?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }
  if (apply && !backupAcknowledged) {
    throw new Error("Refusing apply without --backup-acknowledged");
  }

  log(`target=${redactMongoUri(uri)} database=${databaseName}`);
  log(`mode=${apply ? "APPLY" : "DRY RUN"}`);
  log("rollback: restore the pre-apply mongodump of support-issues and support-replies");

  await mongoose.connect(uri, { dbName: databaseName });
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB connection did not expose a database handle");

  const reports = [
    await migrate("issues", database.collection("support-issues"), "question"),
    await migrate("replies", database.collection("support-replies"), "body"),
  ];

  if (json) {
    console.info(JSON.stringify({ database: databaseName, apply, reports }, null, 2));
  } else {
    for (const report of reports) {
      log(
        `${report.label}: matched=${report.matched} fold=${report.folded} unset-only=${report.unsetOnly} ` +
          `links-moved=${report.linksMoved} dropped-non-http=${report.droppedLinks} ` +
          `too-long=${report.tooLong.length} conflicts=${report.conflicts.length} modified=${report.modified}`,
      );
      for (const entry of report.tooLong) log(`  too-long ${report.label} ${entry}`);
      for (const entry of report.conflicts) log(`  conflict ${report.label} ${entry} (changed while running; re-run)`);
      for (const sample of report.samples) log(`  sample ${report.label} ${sample.id}:\n${sample.appended}`);
    }
    if (!apply) {
      log(`dry run only; after taking a backup, pass --apply --confirm=${databaseName} --backup-acknowledged`);
    } else {
      log(`next: npm run search:backfill -- --apply --confirm=${databaseName}`);
    }
  }

  const blocked = reports.reduce((sum, report) => sum + report.tooLong.length + report.conflicts.length, 0);
  if (blocked > 0) {
    console.error(`${TAG} ${blocked} document(s) were not migrated; see the report above`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`${TAG} fatal`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

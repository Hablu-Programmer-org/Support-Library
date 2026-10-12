/**
 * Encrypts legacy student emails and creates deterministic keyed lookup values.
 * Default mode is dry-run. Apply requires --apply --confirm=<db>; production-like
 * targets additionally require --backup-acknowledged.
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  classifyStudentEmailRecord,
  encryptedSourceCondition,
  legacyStudentEmailCondition,
  protectedStudentEmailUpdate,
  type StudentEmailMigrationRecord,
} from "../lib/student-email-migration";
import {
  decryptStudentEmail,
  isStudentEmailEnvelope,
} from "../lib/student-email-crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const apply = process.argv.includes("--apply");
const backupAcknowledged = process.argv.includes("--backup-acknowledged");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);

function redactMongoUri(uri: string) {
  return uri
    .replace(/\/\/[^/@]+@/, "//***:***@")
    .replace(/\?.*$/, "?<redacted>");
}

function isProductionLike(databaseName: string) {
  return process.env.NODE_ENV === "production" || /(?:^|[-_])(prod|production|live)(?:$|[-_])/i.test(databaseName);
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.MONGODB_DB?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }
  if (apply && isProductionLike(databaseName) && !backupAcknowledged) {
    throw new Error("Refusing production-like apply without --backup-acknowledged");
  }

  console.info(`[student-email-migration] target=${redactMongoUri(uri)} database=${databaseName}`);
  console.info(`[student-email-migration] mode=${apply ? "APPLY" : "DRY RUN"}`);
  console.info("[student-email-migration] rollback: restore the pre-apply encrypted mongodump; do not export plaintext to logs or source control");

  await mongoose.connect(uri, { dbName: databaseName });
  const collection = mongoose.connection.db!.collection("support_issues");
  const cursor = collection.find({}, {
    projection: {
      _id: 1,
      studentEmail: 1,
      studentEmailHash: 1,
      studentEmailEncrypted: 1,
      studentEmailLookup: 1,
    },
  });

  const counts = { scanned: 0, migrated: 0, cleaned: 0, complete: 0, missing: 0, conflicts: 0, errors: 0 };

  for await (const document of cursor) {
    const record: StudentEmailMigrationRecord = document;
    counts.scanned += 1;
    try {
      const classification = classifyStudentEmailRecord(record);
      if (classification === "complete") {
        counts.complete += 1;
        continue;
      }
      if (classification === "invalid") {
        counts.errors += 1;
        console.error(`[student-email-migration] invalid email fields id=${String(record._id)}`);
        continue;
      }
      if (classification === "missing") {
        counts.missing += 1;
        if (apply && (Object.hasOwn(record, "studentEmail") || Object.hasOwn(record, "studentEmailHash"))) {
          const result = await collection.updateOne(
            { ...legacyStudentEmailCondition(record), _id: document._id },
            { $unset: { studentEmail: "", studentEmailHash: "" } },
          );
          if (result.matchedCount !== 1) counts.conflicts += 1;
          else counts.cleaned += 1;
        }
        continue;
      }

      const email = classification === "plaintext"
        ? String(record.studentEmail)
        : isStudentEmailEnvelope(record.studentEmailEncrypted)
          ? decryptStudentEmail(record.studentEmailEncrypted)
          : null;
      if (!email) {
        counts.errors += 1;
        continue;
      }

      if (apply) {
        const condition = classification === "plaintext"
          ? { ...legacyStudentEmailCondition(record), _id: document._id, studentEmailEncrypted: { $exists: false } }
          : { ...encryptedSourceCondition(record._id, record.studentEmailEncrypted), _id: document._id };
        const result = await collection.updateOne(condition, protectedStudentEmailUpdate(email));
        if (result.matchedCount !== 1) {
          counts.conflicts += 1;
          console.error(`[student-email-migration] concurrent update conflict id=${String(record._id)}`);
          continue;
        }
      }
      counts.migrated += 1;
    } catch (error) {
      counts.errors += 1;
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[student-email-migration] failed id=${String(record._id)} error=${message}`);
    }
  }

  console.info("[student-email-migration] summary", counts);
  if (!apply) console.info("[student-email-migration] dry run only; pass --apply --confirm=<db> after taking a backup");
  if (counts.conflicts > 0 || counts.errors > 0) {
    throw new Error(`Migration incomplete: conflicts=${counts.conflicts} errors=${counts.errors}`);
  }
}

main()
  .catch((error) => {
    console.error("[student-email-migration] fatal", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

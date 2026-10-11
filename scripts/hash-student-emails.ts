/**
 * Migration script to hash existing studentEmail values in the support_issues collection.
 *
 * Run with: npm run hash-student-emails
 * Dry run: npm run hash-student-emails -- --dry-run
 * Apply: npm run hash-student-emails -- --apply
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply") || !DRY_RUN;

if (!DRY_RUN && !APPLY) {
  console.log("Usage:");
  console.log("  npm run hash-student-emails -- --dry-run   # Preview changes");
  console.log("  npm run hash-student-emails -- --apply     # Apply changes");
  process.exit(1);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) throw new Error("MONGODB_URI is missing. Copy .env.example to .env.local.");
  if (!dbName) throw new Error("MONGODB_DB is missing. Copy .env.example to .env.local.");

  console.log(`Connecting to MongoDB: ${uri}/${dbName}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);

  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db!;
  const collection = db.collection("support_issues");

  // Find all documents that have studentEmail but no studentEmailHash
  const cursor = collection.find(
    { studentEmail: { $exists: true, $ne: null }, studentEmailHash: { $exists: false } },
    { projection: { _id: 1, studentEmail: 1 } },
  );

  let total = 0;
  let hashed = 0;
  let skipped = 0;
  let errors = 0;

  for await (const doc of cursor) {
    total++;
    const email = doc.studentEmail?.toLowerCase().trim();
    if (!email) {
      skipped++;
      continue;
    }

    try {
      const hash = await bcrypt.hash(email, 12);

      if (APPLY) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { studentEmailHash: hash } },
        );
      }

      hashed++;
      if (total % 100 === 0) {
        console.log(`Processed ${total} documents...`);
      }
    } catch (error) {
      errors++;
      console.error(`Error hashing email for document ${doc._id}:`, error);
    }
  }

  console.log("\n--- Migration Summary ---");
  console.log(`Total documents checked: ${total}`);
  console.log(`Emails hashed: ${hashed}`);
  console.log(`Skipped (no email): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (DRY_RUN) {
    console.log("\nThis was a DRY RUN. No changes were made.");
    console.log("Run with --apply to apply changes.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
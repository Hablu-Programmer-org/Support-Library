import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const uri = process.env.LMS_MONGODB_URI || process.env.MONGODB_URI;
  const dbName = process.env.LMS_MONGODB_DB || "hp-v2";
  if (!uri) throw new Error("MONGODB_URI missing");

  const connection = await mongoose.createConnection(uri, { dbName }).asPromise();
  const db = connection.db!;

  console.log("course sample:", await db.collection("Course").findOne({}));
  console.log(
    "course titles:",
    (await db.collection("Course").find({}, { projection: { courseTitle: 1, title: 1, slug: 1, courseSlug: 1, status: 1 } }).limit(14).toArray()),
  );
  console.log(
    "enrolled statuses:",
    await db.collection("EnrolledCourse").distinct("status"),
  );
  console.log("enrolled fields:", Object.keys((await db.collection("EnrolledCourse").findOne({})) || {}));

  // How many rows per student, and does a user have several batches for one slug?
  const admin = await db.collection("User").findOne({ email: "salman.0210.as@gmail.com" });
  if (admin) {
    console.log(
      "admin enrolments:",
      await db.collection("EnrolledCourse").find({ userId: admin._id }).toArray(),
    );
  }

  // A student with more than one enrolment on the same slug?
  const multi = await db.collection("EnrolledCourse").aggregate([
    { $group: { _id: { userId: "$userId", slug: "$courseSlug" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $limit: 3 },
  ]).toArray();
  console.log("duplicate slug per user sample:", multi);

  await connection.close();
}

main().catch((error) => {
  console.error("FAILED", error);
  process.exit(1);
});

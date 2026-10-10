import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { buildIssueSearchText } from "../lib/search";
import { SupportIssueModel, UserModel } from "../models";

const adminEmail = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase().trim();
const adminName = process.env.SEED_ADMIN_NAME || "Hablu Admin";
const shouldDemo = process.argv.includes("--demo");

async function seedAdmin() {
  if (!adminEmail) throw new Error("SEED_ADMIN_EMAIL is required");

  const user = await UserModel.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        name: adminName,
        email: adminEmail,
        role: "ADMIN",
        isActive: true,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  console.info(`[db:seed] admin ready: ${user.email}`);
  return user._id as mongoose.Types.ObjectId;
}

const demoIssue = {
  studentName: "Demo Student",
  studentEmail: "demo.student@example.com",
  lmsUserId: null,
  title: "Demo React image not rendering",
  question: "Image show hocche na in React component.",
  status: "OPEN" as const,
  priority: "NORMAL" as const,
  tags: ["react", "image"],
};

async function seedDemo(actorId: mongoose.Types.ObjectId) {
  await SupportIssueModel.findOneAndUpdate(
    { title: demoIssue.title, studentEmail: demoIssue.studentEmail },
    {
      $set: {
        ...demoIssue,
        searchText: buildIssueSearchText(demoIssue),
        mentorId: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  console.info("[db:seed] demo data ready");
}

async function main() {
  await dbConnect();
  const adminId = await seedAdmin();
  if (shouldDemo) await seedDemo(adminId);
  await process.exit(0);
}

main().catch((error) => {
  console.error("[db:seed] failed", error);
  process.exit(1);
});
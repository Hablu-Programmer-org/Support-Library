import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { joinSearchText } from "../lib/search";
import { StudentRefModel, SupportCaseModel, UserModel } from "../models";

const adminEmail = (process.env.SEED_ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "").toLowerCase().trim();
const adminName = process.env.SEED_ADMIN_NAME || "Hablu Admin";
const shouldDemo = process.argv.includes("--demo");

async function seedAdmin() {
  if (!adminEmail) throw new Error("SEED_ADMIN_EMAIL or INITIAL_ADMIN_EMAIL is required");

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

async function seedDemo(actorId: mongoose.Types.ObjectId) {
  const student = await StudentRefModel.findOneAndUpdate(
    { studentId: "DEMO-001" },
    {
      $set: {
        name: "Demo Student",
        studentId: "DEMO-001",
        email: "demo.student@example.com",
        phone: "+8801000000000",
        searchText: joinSearchText(["Demo Student", "DEMO-001", "demo.student@example.com"]),
        createdBy: actorId,
        updatedBy: actorId,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  await SupportCaseModel.findOneAndUpdate(
    { title: "Demo React image not rendering", studentRefId: student._id },
    {
      $set: {
        studentRefId: student._id,
        title: "Demo React image not rendering",
        question: "Image show hocche na in React component.",
        status: "OPEN",
        priority: "NORMAL",
        tags: ["react", "image"],
        searchText: joinSearchText(["Demo React image not rendering", "Image show hocche na", "react", "image"]),
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

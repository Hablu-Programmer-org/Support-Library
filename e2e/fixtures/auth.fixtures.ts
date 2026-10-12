import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";

import { dbConnect } from "../../lib/db";
import { getLmsMongoClient } from "../../lib/lms-db";
import { UserModel } from "../../models/User";
import { STAFF_USERS, staffDisplayName } from "./staff-users";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) throw new Error("AUTH_SECRET not set in env for test fixtures");
const secret: string = authSecret;

// Auth.js derives the JWT encryption key from the configured cookie name.
const sessionTokenCookieName = "support-library.session-token";

async function upsertStaffUser(user: (typeof STAFF_USERS)[number]) {
  await dbConnect();
  const lmsClient = await getLmsMongoClient();
  const lmsDb = process.env.LMS_MONGODB_DB;
  if (!lmsDb) throw new Error("LMS_MONGODB_DB is missing for E2E setup");

  await Promise.all([
    UserModel.updateOne(
      { _id: new mongoose.Types.ObjectId(user.id) },
      {
        $set: {
          name: staffDisplayName(user.name),
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: new Date(),
        },
      },
      { upsert: true },
    ),
    lmsClient.db(lmsDb).collection("User").updateOne(
      { email: user.email },
      {
        $set: {
          userId: user.id,
          email: user.email,
          name: staffDisplayName(user.name),
          role: user.role === "ADMIN" ? "ADMIN" : user.role === "MENTOR" ? "INSTRUCTOR" : "STUDENT",
          image: null,
          isActive: user.isActive,
        },
        $setOnInsert: { _id: new mongoose.Types.ObjectId() },
      },
      { upsert: true },
    ),
  ]);
}

async function createSessionToken(user: (typeof STAFF_USERS)[number]) {
  return encode({
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: staffDisplayName(user.name),
      role: user.role,
      isActive: user.isActive,
    },
    secret: secret,
    salt: sessionTokenCookieName,
    maxAge: 60 * 60 * 24,
  });
}

for (const user of STAFF_USERS) {
  setup(`authenticate as ${user.name}`, async ({ page }) => {
    await upsertStaffUser(user);
    const token = await createSessionToken(user);
    const storageStatePath = path.resolve(__dirname, `../.auth/${user.name}.json`);

    await page.goto("/");
    await page.context().addCookies([
      {
        name: sessionTokenCookieName,
        value: token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.context().storageState({ path: storageStatePath });
  });
}

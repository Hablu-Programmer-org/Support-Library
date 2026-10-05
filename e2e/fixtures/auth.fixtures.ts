import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";

import { dbConnect } from "../../lib/db";
import { UserModel } from "../../models/User";
import { STAFF_USERS, staffDisplayName } from "./staff-users";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) throw new Error("AUTH_SECRET not set in env for test fixtures");
const secret: string = authSecret;

// Default cookie name for development (non-HTTPS)
const sessionTokenCookieName = "authjs.session-token";

async function upsertStaffUser(user: (typeof STAFF_USERS)[number]) {
  await dbConnect();
  await UserModel.updateOne(
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
  );
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
        name: "authjs.session-token",
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
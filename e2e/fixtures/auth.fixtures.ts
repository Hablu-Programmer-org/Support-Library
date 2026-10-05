import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";

import { dbConnect } from "../../lib/db";
import { UserModel, type UserRole } from "../../models/User";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) throw new Error("AUTH_SECRET not set in env for test fixtures");
const secret: string = authSecret;

// Default cookie name for development (non-HTTPS)
const sessionTokenCookieName = "authjs.session-token";

const users = [
  { id: "0000000000000000000000a1", name: "admin", email: "owner@hablu-programmer.com", role: "ADMIN", isActive: true },
  { id: "0000000000000000000000b2", name: "mentor", email: "mentor@hablu-programmer.com", role: "MENTOR", isActive: true },
  { id: "0000000000000000000000c3", name: "viewer", email: "viewer@hablu-programmer.com", role: "VIEWER", isActive: true },
];

async function upsertStaffUser(user: (typeof users)[number]) {
  await dbConnect();
  await UserModel.updateOne(
    { _id: new mongoose.Types.ObjectId(user.id) },
    {
      $set: {
        name: `${user.name.charAt(0).toUpperCase() + user.name.slice(1)} User`,
        email: user.email,
        role: user.role as UserRole,
        isActive: user.isActive,
        lastLoginAt: new Date(),
      },
    },
    { upsert: true },
  );
}

async function createSessionToken(user: typeof users[0]) {
  return encode({
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: `${user.name.charAt(0).toUpperCase() + user.name.slice(1)} User`,
      role: user.role,
      isActive: user.isActive,
    },
    secret: secret,
    salt: sessionTokenCookieName,
    maxAge: 60 * 60 * 24,
  });
}

for (const user of users) {
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

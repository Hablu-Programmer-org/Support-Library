import "server-only";

import { dbConnect } from "@/lib/db";
import { UserModel } from "@/models";

export const RECENT_AUTH_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function recentlySignedIn(userId: string, now = new Date()) {
  await dbConnect();
  const user = await UserModel.findById(userId).select("lastLoginAt").lean();
  return Boolean(
    user?.lastLoginAt && now.getTime() - user.lastLoginAt.getTime() <= RECENT_AUTH_WINDOW_MS,
  );
}

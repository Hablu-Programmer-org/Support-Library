import { MongoDBAdapter } from "@auth/mongodb-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import authConfig from "@/auth.config";
import { dbConnect, getMongoClient } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { findLmsUserByEmail } from "@/lib/lms";
import { mapLmsRole } from "@/lib/lms-roles";
import { UserModel, type UserRole } from "@/models/User";

const adapter = MongoDBAdapter(
  async () => {
    await dbConnect();
    return getMongoClient();
  },
  { databaseName: process.env.MONGODB_DB },
);

/**
 * Local cache row for a logged-in hp-v2 user. Name/image keep the Google
 * profile; role and isActive always mirror hp-v2, so the local row never makes
 * a staff decision on its own.
 */
export const ensureStaffUser = async (user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
  isActive: boolean;
}) => {
  const email = normalizeEmail(user.email);
  await dbConnect();

  const existing = await UserModel.findOne({ email });

  if (existing) {
    if (user.name) existing.name = user.name;
    if (user.image) existing.image = user.image;
    existing.role = user.role;
    existing.isActive = user.isActive;
    existing.lastLoginAt = new Date();
    await existing.save();
    return existing;
  }

  return UserModel.create({
    name: user.name ?? email,
    email,
    image: user.image ?? null,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: new Date(),
  });
};

/**
 * Syncs a rejected login into the local cache so any existing session of that
 * user is dropped on the next authenticated request.
 */
const markStaffInactive = async (email: string) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  await dbConnect();
  await UserModel.updateOne({ email: normalized }, { $set: { isActive: false } });
};

const config = {
  adapter,
  session: { strategy: "jwt" as const, maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [Google],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      if (!user.email) return false;

      // The main Hablu Programmer database is the source of truth for who may
      // log in and which role they get. Students land on VIEWER; staff roles
      // map to ADMIN/MENTOR (see mapLmsRole).
      const lmsUser = await findLmsUserByEmail(user.email);

      if (!lmsUser || lmsUser.isActive === false) {
        await markStaffInactive(user.email);
        return false;
      }

      await ensureStaffUser({
        id: user.id ?? user.email,
        email: user.email,
        name: lmsUser.name || user.name,
        image: lmsUser.image || user.image,
        role: mapLmsRole(lmsUser.role),
        isActive: true,
      });

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;

      const email = normalizeEmail(token.email ?? "");
      if (!email) return token;

      await dbConnect();
      const profile = await UserModel.findOne({ email }).lean();
      if (!profile || !profile.isActive) {
        token.role = undefined;
        token.isActive = false;
        return token;
      }

      token.id = profile._id.toString();
      token.role = profile.role as UserRole;
      token.isActive = true;
      return token;
    },
    async session({ session, token }) {
      return authConfig.callbacks?.session?.({ session, token } as never) ?? session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  ...config,
});

import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import authConfig from "@/auth.config";
import { dbConnect } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { findLmsUserByEmail } from "@/lib/lms";
import { mapLmsRole } from "@/lib/lms-roles";
import { getRequestContext } from "@/lib/request-context";
import { recordAuditEvent } from "@/lib/services/audit";
import { UserModel, type UserRole } from "@/models/User";

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
  recordLogin?: boolean;
}) => {
  const email = normalizeEmail(user.email);
  await dbConnect();

  const existing = await UserModel.findOne({ email });

  if (existing) {
    if (user.name) existing.name = user.name;
    if (user.image) existing.image = user.image;
    existing.role = user.role;
    existing.isActive = user.isActive;
    if (user.recordLogin) existing.lastLoginAt = new Date();
    if (existing.isModified()) await existing.save();
    return existing;
  }

  return UserModel.create({
    name: user.name ?? email,
    email,
    image: user.image ?? null,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.recordLogin ? new Date() : null,
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

      const profile = await ensureStaffUser({
        id: user.id ?? user.email,
        email: user.email,
        name: lmsUser.name || user.name,
        image: lmsUser.image || user.image,
        role: mapLmsRole(lmsUser.role),
        isActive: true,
        recordLogin: true,
      });

      const ctx = await getRequestContext().catch(() => undefined);
      await recordAuditEvent({
        actorId: profile._id.toString(),
        action: "OAUTH_CALLBACK",
        resourceType: "OAuthCallback",
        resourceId: normalizeEmail(user.email),
        result: "SUCCEEDED",
      }, ctx);

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;

      const email = normalizeEmail(token.email ?? "");
      if (!email) {
        token.role = undefined;
        token.isActive = false;
        return token;
      }

      const lmsUser = await findLmsUserByEmail(email);
      if (!lmsUser || lmsUser.isActive === false) {
        await markStaffInactive(email);
        token.role = undefined;
        token.isActive = false;
        return token;
      }

      const profile = await ensureStaffUser({
        id: token.id ?? token.sub ?? email,
        email,
        name: lmsUser.name || token.name,
        image: lmsUser.image || token.picture,
        role: mapLmsRole(lmsUser.role),
        isActive: true,
        recordLogin: false,
      });

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

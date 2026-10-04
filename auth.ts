import { MongoDBAdapter } from "@auth/mongodb-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import authConfig from "@/auth.config";
import { isAllowlisted, normalizeEmail, parseAllowlist } from "@/lib/auth-allowlist";
import { dbConnect, getMongoClient } from "@/lib/db";
import { UserModel, type UserRole } from "@/models/User";

const initialAdmin = (process.env.INITIAL_ADMIN_EMAIL ?? "").toLowerCase().trim();

const adapter = MongoDBAdapter(
  async () => {
    await dbConnect();
    return getMongoClient();
  },
  { databaseName: process.env.MONGODB_DB },
);

export const ensureStaffUser = async (user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) => {
  const email = normalizeEmail(user.email);
  await dbConnect();

  const existing = await UserModel.findOne({ email });

  if (existing) {
    if (user.name) existing.name = user.name;
    if (user.image) existing.image = user.image;
    existing.lastLoginAt = new Date();
    await existing.save();
    return existing;
  }

  return UserModel.create({
    name: user.name ?? email,
    email,
    image: user.image ?? null,
    role: email === initialAdmin ? "ADMIN" : "VIEWER",
    isActive: true,
    lastLoginAt: new Date(),
  });
};

const config = {
  adapter,
  session: { strategy: "jwt" as const, maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [Google],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      if (!isAllowlisted(user.email, parseAllowlist(process.env.STAFF_EMAIL_ALLOWLIST))) {
        return false;
      }
      if (!user.email) return false;

      const profile = await ensureStaffUser({
        id: user.id ?? user.email,
        email: user.email,
        name: user.name,
        image: user.image,
      });

      if (!profile.isActive) return false;

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
  events: {
    async createUser({ user }) {
      if (user.email && user.id) {
        await ensureStaffUser({
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        });
      }
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  ...config,
});

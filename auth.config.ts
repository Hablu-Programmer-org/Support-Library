import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import type { UserRole } from "@/models/User";

export default {
  secret: process.env.AUTH_SECRET,
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = token.role as UserRole | undefined;
        session.user.isActive = token.isActive === true;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

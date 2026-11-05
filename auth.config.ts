import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import type { UserRole } from "@/models/user";

/**
 * Session lifetime, kept in one place so the edge proxy (this file) and the
 * Node auth config (auth.ts) can never disagree. The cookie `Max-Age` below
 * must match this value: the JWT `exp` is useless if the browser drops the
 * cookie earlier.
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60; // 24 hours

export default {
  secret: process.env.AUTH_SECRET,
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: "support-library.session-token",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS, // 30 days, mirrors session.maxAge
      },
    },
    callbackUrl: {
      name: "support-library.callback-url",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours
      },
    },
    csrfToken: {
      name: "support-library.csrf-token",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = token.role as UserRole | undefined;
        session.user.isActive = token.isActive === true;
        session.user.canManageToolAccess = token.canManageToolAccess === true;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

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
  cookies: {
    sessionToken: {
      name: "support-library.session-token",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours
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
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
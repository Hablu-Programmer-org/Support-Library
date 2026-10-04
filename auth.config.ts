import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  secret: process.env.AUTH_SECRET,
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {},
} satisfies NextAuthConfig;
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/", "/login", "/unauthorized", "/api/health"]);

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname, search } = nextUrl;

  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!req.auth?.user) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (req.auth.user.isActive === false) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("error", "Inactive");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};

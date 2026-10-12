import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";
import { createContentSecurityPolicy } from "@/lib/content-security-policy";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/unauthorized",
  "/api/health",
  "/api/health/live",
  "/api/health/ready",
]);

export const proxy = auth((req) => {
  const { nextUrl } = req;
  const { pathname, search } = nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = createContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  const secure = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  if (pathname.startsWith("/api/auth")) return secure(next());
  if (PUBLIC_PATHS.has(pathname)) return secure(next());

  if (!req.auth?.user) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", pathname + search);
    return secure(NextResponse.redirect(url));
  }

  if (req.auth.user.isActive === false) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("error", "Inactive");
    return secure(NextResponse.redirect(url));
  }

  return secure(next());
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};

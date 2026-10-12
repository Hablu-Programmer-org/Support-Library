import type { RateLimitScope } from "@/lib/services/rate-limit";

export function getAuthRateLimitScope(method: string, pathname: string): RateLimitScope | null {
  if (method === "POST" && /^\/api\/auth\/signin(?:\/google)?\/?$/.test(pathname)) {
    return "oauth.signin";
  }

  if ((method === "GET" || method === "POST") && pathname === "/api/auth/callback/google") {
    return "oauth.callback";
  }

  return null;
}

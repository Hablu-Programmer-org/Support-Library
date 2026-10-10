import { auth } from "@/auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { hasRole, type UserRole } from "@/lib/roles";

type AuthGuardResult =
  | { ok: true; session: Session }
  | { ok: false; error: "UNAUTHENTICATED" | "INACTIVE" | "FORBIDDEN" };

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.isActive === false) {
    redirect("/unauthorized");
  }
  return session;
}

export async function requireRole(...allowed: UserRole[]) {
  const session = await requireSession();
  const userRole = session.user.role;
  if (session.user.isActive === false || !userRole || !allowed.some((r) => hasRole(userRole, r))) {
    redirect("/unauthorized");
  }
  return session;
}

export async function assertRole(...allowed: UserRole[]): Promise<AuthGuardResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "UNAUTHENTICATED" };
  if (session.user.isActive === false) return { ok: false, error: "INACTIVE" };

  const userRole = session.user.role;
  if (!userRole || !allowed.some((r) => hasRole(userRole, r))) {
    return { ok: false, error: "FORBIDDEN" };
  }

  return { ok: true, session };
}

export async function requireMentorOrAdmin() {
  return requireRole("ADMIN", "MENTOR");
}

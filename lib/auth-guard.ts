import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasRole, type UserRole } from "@/lib/roles";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(...allowed: UserRole[]) {
  const session = await requireSession();
  const userRole = session.user.role;
  if (!userRole || !allowed.some((r) => hasRole(userRole, r))) {
    redirect("/unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}

export async function requireMentorOrAdmin() {
  return requireRole("ADMIN", "MENTOR");
}
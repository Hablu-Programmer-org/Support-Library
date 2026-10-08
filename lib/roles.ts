export const USER_ROLES = ["ADMIN", "MENTOR", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  MENTOR: "Mentor",
  VIEWER: "Viewer",
};

export const ROLE_RANK: Record<UserRole, number> = {
  ADMIN: 3,
  MENTOR: 2,
  VIEWER: 1,
};

export const hasRole = (userRole: UserRole, required: UserRole) =>
  ROLE_RANK[userRole] >= ROLE_RANK[required];

export const isAdmin = (role: UserRole) => role === "ADMIN";

export const canMutate = (role: UserRole) => role === "ADMIN" || role === "MENTOR";

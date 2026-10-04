import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/models/User";

type StaffSessionUser = DefaultSession["user"] & {
  id: string;
  role?: UserRole;
  isActive?: boolean;
};

declare module "next-auth" {
  interface Session {
    user: StaffSessionUser;
  }

  interface User {
    role?: UserRole;
    isActive?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    isActive?: boolean;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: UserRole;
  }
}

export {};

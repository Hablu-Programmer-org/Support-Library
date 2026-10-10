import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { UserModel, type UserRole } from "@/models";
import { USER_ROLES } from "@/lib/constants";

type LeanDoc = Record<string, unknown>;

export type StaffListItem = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const toStaffListItem = (user: LeanDoc): StaffListItem => ({
  id: String(user._id),
  name: String(user.name),
  email: String(user.email),
  image: user.image as string | null | undefined,
  role: user.role as UserRole,
  isActive: user.isActive !== false,
  lastLoginAt: user.lastLoginAt as Date | null | undefined,
  createdAt: user.createdAt as Date | undefined,
  updatedAt: user.updatedAt as Date | undefined,
});

export async function listStaff() {
  await dbConnect();
  const users = await UserModel.find({}).sort({ createdAt: -1 }).lean();
  return (users as LeanDoc[]).map(toStaffListItem);
}

async function wouldRemoveLastActiveAdmin(userId: string, nextRole: UserRole, nextIsActive: boolean) {
  const user = await UserModel.findById(userId).lean();
  if (!user) return false;
  if (user.role !== "ADMIN" || user.isActive === false) return false;
  if (nextRole === "ADMIN" && nextIsActive) return false;

  const activeAdminCount = await UserModel.countDocuments({ role: "ADMIN", isActive: true });
  return activeAdminCount <= 1;
}

export async function updateStaffRole(userId: string, role: UserRole) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return { ok: false as const, error: "Invalid staff id" };
  if (!USER_ROLES.includes(role)) return { ok: false as const, error: "Invalid role" };
  await dbConnect();

  const existing = await UserModel.findById(userId).lean();
  if (!existing) return { ok: false as const, error: "Staff not found" };
  if (await wouldRemoveLastActiveAdmin(userId, role, existing.isActive !== false)) {
    return { ok: false as const, error: "The last active admin cannot be demoted." };
  }

  const user = await UserModel.findByIdAndUpdate(userId, { role }, { new: true, runValidators: true }).lean();
  return user ? { ok: true as const, staff: toStaffListItem(user) } : { ok: false as const, error: "Staff not found" };
}

export async function updateStaffActive(userId: string, isActive: boolean) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return { ok: false as const, error: "Invalid staff id" };
  await dbConnect();

  const existing = await UserModel.findById(userId).lean();
  if (!existing) return { ok: false as const, error: "Staff not found" };
  if (await wouldRemoveLastActiveAdmin(userId, existing.role as UserRole, isActive)) {
    return { ok: false as const, error: "The last active admin cannot be deactivated." };
  }

  const user = await UserModel.findByIdAndUpdate(userId, { isActive }, { new: true, runValidators: true }).lean();
  return user ? { ok: true as const, staff: toStaffListItem(user) } : { ok: false as const, error: "Staff not found" };
}

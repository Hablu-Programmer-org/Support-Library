import "server-only";

import { normalizeEmail } from "@/lib/email";
import { getLmsMongoClient } from "@/lib/lms-db";
import { escapeRegex } from "@/lib/search";

const getLmsDbName = () => process.env.LMS_MONGODB_DB || "hp-v2";

export type LmsUser = {
  userId: string;
  email: string;
  name: string | null;
  role: string | null;
  image: string | null;
  isActive: boolean;
};

const toLmsUser = (doc: Record<string, unknown> | null): LmsUser | null => {
  if (!doc) return null;
  return {
    userId: String(doc.userId ?? ""),
    email: String(doc.email ?? ""),
    name: typeof doc.name === "string" ? doc.name : String(doc.name ?? "") || null,
    role: typeof doc.role === "string" ? doc.role : null,
    image: typeof doc.image === "string" ? doc.image : null,
    isActive: doc.isActive !== false,
  };
};

/**
 * Read-only lookup in the main Hablu Programmer database (hp-v2).
 *
 * Tries the exact normalized email first (indexed), then falls back to a
 * case-insensitive match for rows stored with different casing.
 */
export const findLmsUserByEmail = async (email?: string | null): Promise<LmsUser | null> => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const client = await getLmsMongoClient();
  const users = client.db(getLmsDbName()).collection("User");

  const exact = await users.findOne(
    { email: normalized },
    { projection: { userId: 1, email: 1, name: 1, role: 1, image: 1, isActive: 1 } },
  );

  const doc = exact ?? (await users.findOne(
    { email: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" } },
    { projection: { userId: 1, email: 1, name: 1, role: 1, image: 1, isActive: 1 } },
  ));

  return toLmsUser(doc as Record<string, unknown> | null);
};

export type LmsStudentLookup = { userId: string; name: string };

/**
 * Email autocomplete lookup for the issue form. hp-v2 only: a matched email
 * lets the form prefill the student's name.
 */
export const lookupLmsStudent = async (email: string): Promise<LmsStudentLookup | null> => {
  const user = await findLmsUserByEmail(email);
  if (!user) return null;
  return { userId: user.userId, name: user.name || user.email };
};

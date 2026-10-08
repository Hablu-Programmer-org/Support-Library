export const normalizeEmail = (email?: string | null) =>
  (email ?? "").toLowerCase().trim();

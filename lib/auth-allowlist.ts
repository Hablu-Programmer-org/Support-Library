export const normalizeEmail = (email?: string | null) =>
  (email ?? "").toLowerCase().trim();

export const parseAllowlist = (env?: string) =>
  (env ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const isAllowlisted = (email?: string | null, allowlist?: string[]) => {
  const normalized = normalizeEmail(email);
  if (!normalized || !allowlist?.length) return false;
  return allowlist.some(
    (a) => a.startsWith("@") ? normalized.endsWith(a) : normalized === a,
  );
};
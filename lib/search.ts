export const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const joinSearchText = (values: Array<string | number | null | undefined>) =>
  normalizeText(values.filter((value) => value !== null && value !== undefined && value !== "").join(" "));

export const buildSearchRegex = (query?: string | null) => {
  const normalized = normalizeText(query);
  if (normalized.length < 2) return null;
  return { $regex: escapeRegex(normalized), $options: "i" };
};

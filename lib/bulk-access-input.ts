export type BulkAccessInput = {
  emails: string[];
  names: string[];
  invalid: string[];
  duplicateCount: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function parseBulkAccessInput(raw: string): BulkAccessInput {
  const emails: string[] = [];
  const names: string[] = [];
  const invalid: string[] = [];
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  let duplicateCount = 0;

  for (const sourceLine of raw.split(/\r?\n/u)) {
    const line = sourceLine.replace(/[\u200B-\u200D\uFEFF]/gu, "").trim();
    if (!line || line.startsWith("#")) continue;

    if (line.includes("@")) {
      const email = line.toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        invalid.push(line);
      } else if (seenEmails.has(email)) {
        duplicateCount += 1;
      } else {
        seenEmails.add(email);
        emails.push(email);
      }
      continue;
    }

    const nameKey = line.toLocaleLowerCase("en-US");
    if (seenNames.has(nameKey)) {
      duplicateCount += 1;
    } else {
      seenNames.add(nameKey);
      names.push(line);
    }
  }

  return { emails, names, invalid, duplicateCount };
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "<invalid>";
  return `${local.slice(0, 1)}***@${domain}`;
}

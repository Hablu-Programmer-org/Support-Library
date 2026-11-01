/**
 * Live support drift guard (local, pre-release).
 *
 * The live support schedule and its Bengali copy are configured twice on
 * purpose: the LMS frontend (`frontend/src/lib/config/support.ts`) owns the
 * original implementation, and this app keeps its own copy so the Support
 * Library can offer the same join experience without a cross-app dependency.
 *
 * The room itself is configured **once**, here, through the `LIVE_SUPPORT_*`
 * environment variables — and it has no source default, because on Google Meet
 * the join URL is the key to the room. The LMS only links to
 * `/dashboard/support`, because a student must have an open request before the
 * room opens; its public bundle must never carry the join URL, meeting code or
 * passcode again. That inversion is asserted below, together with the join CTA
 * wording ("Join Live support"), so the two apps cannot drift. Whether the URL
 * and the platform name agree is enforced at boot by `lib/env.ts`.
 *
 * Nothing can compare the apps at compile time — they are three separate git
 * repositories, so neither repo's CI can see the other. This script is the
 * guard: run it from a full local checkout before a release and it fails loudly
 * when the two copies disagree.
 *
 * Usage:
 *   npm run check:live-support
 *
 * Exits 0 only when every value was read from both apps and they agree; it
 * exits 1 on drift *and* when a check could not run, so a release gate can
 * trust a green result.
 *
 * Read-only: it opens no database connection and writes nothing. It only needs
 * the frontend checkout to sit next to this repo (the default layout).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LIVE_SUPPORT_CTA, SUPPORT_SHIFTS } from "../lib/config/live-support";

// `fileURLToPath` rather than `new URL(...).pathname`: on Windows the raw
// pathname keeps a leading slash ("/D:/..."), which `resolve` then mangles.
const HERE = dirname(fileURLToPath(import.meta.url));
const SUPPORT_ROOT = resolve(HERE, "..");
const FRONTEND_ROOT = resolve(SUPPORT_ROOT, "../frontend");

const FAILURES: string[] = [];
const NOTES: string[] = [];

const readFileAt = (absolutePath: string): string | null => {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }
};

const readFrontend = (relativePath: string) =>
  readFileAt(resolve(FRONTEND_ROOT, relativePath));
const readLocal = (relativePath: string) =>
  readFileAt(resolve(SUPPORT_ROOT, relativePath));

/**
 * Evaluate a plain `a * b + c` expression.
 *
 * Deliberately not `eval`: the only characters accepted are digits, spaces, `*`
 * and `+`, so a stray identifier can never reach an interpreter.
 */
const evaluateNumber = (expression: string): number | null => {
  const trimmed = expression.trim();
  if (!trimmed || !/^[0-9\s*+]+$/.test(trimmed)) return null;

  const sums = trimmed.split("+").map((chunk) => {
    const factors = chunk
      .split("*")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));
    return factors.reduce((total, value) => total * value, 1);
  });

  return sums.reduce((total, value) => total + value, 0);
};

const constantCache = new Map<string, number>();

/** Resolve an identifier such as `MINUTES_IN_DAY` from a `const` in the file. */
const constantValue = (source: string, name: string): number | null => {
  const cached = constantCache.get(name);
  if (cached !== undefined) return cached;

  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([^;]+);`));
  if (!match) return null;

  const value = evaluateNumber(match[1]);
  if (value !== null) constantCache.set(name, value);
  return value;
};

/** Every `field: <number literal | constant>` value in a source file. */
const numericFields = (source: string, field: string): number[] => {
  const values: number[] = [];
  for (const match of source.matchAll(new RegExp(`${field}\\s*:\\s*([^,}\\n]+)`, "g"))) {
    const raw = match[1].trim();
    const value = evaluateNumber(raw) ?? constantValue(source, raw);
    if (value !== null) values.push(value);
  }
  return values;
};

/**
 * Whether a key is present at all, whatever its value syntax.
 *
 * Room credentials must be checked with this rather than a quote-only match: a
 * URL written as a template literal would otherwise slip past it.
 */
const hasField = (source: string, field: string): boolean =>
  new RegExp(`\\b${field}\\s*:`).test(source);

function compareShifts() {
  const frontendSource = readFrontend("src/lib/config/support.ts");
  if (!frontendSource) {
    NOTES.push(
      "frontend/src/lib/config/support.ts not found — run this from a checkout where the frontend repo sits next to support-library.",
    );
    return;
  }

  for (const field of ["start", "end"] as const) {
    const theirs = numericFields(frontendSource, field).slice(0, 2);
    const ours = [SUPPORT_SHIFTS.morning[field], SUPPORT_SHIFTS.night[field]];

    if (theirs.length < ours.length) {
      NOTES.push(
        `Read ${theirs.length} of 2 frontend shift ${field} values; compare the remaining one manually.`,
      );
      continue;
    }

    if (theirs[0] !== ours[0] || theirs[1] !== ours[1]) {
      FAILURES.push(
        `SUPPORT_SHIFTS.${field}: frontend=[${theirs.join(", ")}] vs support-library=[${ours.join(", ")}]`,
      );
    }
  }

  compareScheduleCopy(frontendSource);
}

/**
 * The visible words of the Bengali schedule sentence.
 *
 * The numbers can agree while the sentence a student reads differs — the
 * frontend says "সন্ধ্যা ৭:৩০ থেকে", not "… ৭:৩০ টা থেকে" — so the template's
 * literal parts are compared too, with every `${...}` interpolation collapsed
 * to one token.
 */
function compareScheduleCopy(frontendSource: string) {
  const words = (source: string) =>
    source
      .match(/supportScheduleBn\s*=\s*`([^`]*)`/)?.[1]
      .replace(/\$\{[^}]*\}/g, "…");

  const localSource = readLocal("lib/config/live-support.ts");
  const theirs = words(frontendSource);
  const ours = localSource ? words(localSource) : null;

  if (!theirs || !ours) {
    NOTES.push("Could not read both schedule sentences; compare the Bengali copy manually.");
    return;
  }

  if (theirs !== ours) {
    FAILURES.push(
      `supportScheduleBn words differ:\n        frontend="${theirs}"\n        support-library="${ours}"`,
    );
  }
}

/**
 * The join CTA must read the same in both apps.
 *
 * The label is deliberately platform-agnostic ("Join Live support"), so the
 * platform name is no longer compared: the LMS no longer publishes it at all.
 * What can still drift is the wording a student sees, so the LMS help-center
 * copy is the source of truth on its side and `LIVE_SUPPORT_CTA.join` on ours.
 */
function compareJoinLabel() {
  const frontendSource = readFrontend("src/components/pages/help-center/index.tsx");
  if (!frontendSource) {
    NOTES.push(
      "frontend help-center copy not found — run this from a checkout where the frontend repo sits next to support-library.",
    );
    return;
  }

  const theirs = frontendSource.match(/“Join ([^”]+)”/)?.[1];
  if (!theirs) {
    NOTES.push("Could not read the join label from the LMS help-center copy; compare it manually.");
    return;
  }

  if (`Join ${theirs}` !== LIVE_SUPPORT_CTA.join) {
    FAILURES.push(
      `join label: frontend="Join ${theirs}" vs support-library="${LIVE_SUPPORT_CTA.join}"`,
    );
  }

  for (const stale of ["Join Google Meet", "Open Google Meet"]) {
    if (frontendSource.includes(stale)) {
      FAILURES.push(`LMS help-center still says "${stale}"`);
    }
  }
}

/**
 * The room must be configured in exactly one app.
 *
 * The Support Library resolves the join URL, meeting ID and passcode on the
 * server and only hands them to an eligible session. If any of them reappear in
 * the LMS config, the gate can be bypassed by reading the public bundle, so
 * this check fails the release instead of comparing values.
 */
function compareRoom() {
  const frontendSource = readFrontend("src/lib/config/site.ts");
  const localSource = readLocal("lib/config/live-support.ts");
  if (!frontendSource || !localSource) {
    NOTES.push("Could not read both meeting configs; compare the room manually.");
    return;
  }

  const frontendBlock = frontendSource.match(/support\s*:\s*\{[\s\S]*?\n\s*\},/)?.[0] ?? "";
  if (!frontendBlock) {
    NOTES.push("Could not read the frontend `support` block from site.ts; compare it manually.");
    return;
  }

  for (const field of ["joinUrl", "notesUrl", "meetingId", "passcode"] as const) {
    if (hasField(frontendBlock, field)) {
      FAILURES.push(
        `frontend site.ts still publishes "support.${field}" — room credentials must stay server-side in support-library`,
      );
    }
  }

  if (!hasField(frontendBlock, "libraryUrl")) {
    FAILURES.push(
      "frontend site.ts has no support.libraryUrl — the LMS has no way to reach live support",
    );
  }
}

compareShifts();
compareRoom();
compareJoinLabel();

for (const note of NOTES) console.warn(`! ${note}`);

if (FAILURES.length > 0) {
  console.error("\nLive support configuration has drifted:\n");
  for (const failure of FAILURES) console.error(`  ✗ ${failure}`);
  console.error(
    "\nUpdate both apps so a student sees the same schedule and joins the same room.",
  );
  process.exit(1);
}

if (NOTES.length > 0) {
  // Never report a match for a check that did not run — a green result here is
  // what a release gate would trust.
  console.error(
    "\nCould not verify the items listed above, so no drift check was performed for them.",
  );
  console.error("Run this from a full local checkout (frontend next to support-library).");
  process.exit(1);
}

console.log("Live support config matches the frontend.");

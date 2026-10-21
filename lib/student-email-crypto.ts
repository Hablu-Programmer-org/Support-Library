import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_VERSION_PATTERN = /^v[1-9]\d*$/;
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const AAD_PREFIX = "support-library:student-email";

export type StudentEmailEnvelope = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

export type StudentEmailLookup = {
  digest: string;
  keyVersion: string;
};

type StudentEmailKeyConfig = {
  activeVersion: string;
  encryptionKeys: Map<string, Buffer>;
  lookupKeys: Map<string, Buffer>;
};

function parseKeyring(value: string | undefined, variableName: string) {
  if (!value) throw new Error(`${variableName} is required`);

  const keys = new Map<string, Buffer>();
  for (const entry of value.split(",")) {
    const separator = entry.indexOf(":");
    const version = entry.slice(0, separator).trim();
    const encodedKey = entry.slice(separator + 1).trim();
    if (separator < 1 || !KEY_VERSION_PATTERN.test(version) || !BASE64_KEY_PATTERN.test(encodedKey)) {
      throw new Error(`${variableName} must use vN:<32-byte-base64>[,vN:<32-byte-base64>] format`);
    }
    if (keys.has(version)) throw new Error(`${variableName} contains duplicate version ${version}`);

    const key = Buffer.from(encodedKey, "base64");
    if (key.length !== KEY_BYTES) throw new Error(`${variableName} keys must decode to 32 bytes`);
    keys.set(version, key);
  }
  return keys;
}

export function getStudentEmailKeyConfig(
  env: NodeJS.ProcessEnv = process.env,
): StudentEmailKeyConfig {
  const activeVersion = env.STUDENT_EMAIL_KEY_VERSION?.trim() ?? "";
  if (!KEY_VERSION_PATTERN.test(activeVersion)) {
    throw new Error("STUDENT_EMAIL_KEY_VERSION must use vN format");
  }

  const encryptionKeys = parseKeyring(
    env.STUDENT_EMAIL_ENCRYPTION_KEYS,
    "STUDENT_EMAIL_ENCRYPTION_KEYS",
  );
  const lookupKeys = parseKeyring(env.STUDENT_EMAIL_LOOKUP_KEYS, "STUDENT_EMAIL_LOOKUP_KEYS");
  if (!encryptionKeys.has(activeVersion) || !lookupKeys.has(activeVersion)) {
    throw new Error(`Active student email key version ${activeVersion} must exist in both keyrings`);
  }

  return { activeVersion, encryptionKeys, lookupKeys };
}

export function normalizeStudentEmail(email: string) {
  return email.trim().toLowerCase();
}

function emailAad(keyVersion: string) {
  return Buffer.from(`${AAD_PREFIX}:${keyVersion}`, "utf8");
}

export function encryptStudentEmail(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): StudentEmailEnvelope {
  const config = getStudentEmailKeyConfig(env);
  const key = config.encryptionKeys.get(config.activeVersion)!;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(emailAad(config.activeVersion));
  const ciphertext = Buffer.concat([
    cipher.update(normalizeStudentEmail(email), "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: config.activeVersion,
  };
}

export function decryptStudentEmail(
  envelope: StudentEmailEnvelope,
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = getStudentEmailKeyConfig(env);
  const key = config.encryptionKeys.get(envelope.keyVersion);
  if (!key) throw new Error(`Unknown student email encryption key version ${envelope.keyVersion}`);

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(envelope.iv, "base64"),
    );
    decipher.setAAD(emailAad(envelope.keyVersion));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Student email ciphertext authentication failed");
  }
}

function lookupDigest(email: string, key: Buffer) {
  return createHmac("sha256", key).update(normalizeStudentEmail(email), "utf8").digest("hex");
}

export function createStudentEmailLookup(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): StudentEmailLookup {
  const config = getStudentEmailKeyConfig(env);
  return {
    digest: lookupDigest(email, config.lookupKeys.get(config.activeVersion)!),
    keyVersion: config.activeVersion,
  };
}

export function createStudentEmailLookupCandidates(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = getStudentEmailKeyConfig(env);
  return [...config.lookupKeys].map(([keyVersion, key]) => ({
    "studentEmailLookup.keyVersion": keyVersion,
    "studentEmailLookup.digest": lookupDigest(email, key),
  }));
}

export function protectStudentEmail(email: string, env: NodeJS.ProcessEnv = process.env) {
  return {
    encrypted: encryptStudentEmail(email, env),
    lookup: createStudentEmailLookup(email, env),
  };
}

export function isStudentEmailEnvelope(value: unknown): value is StudentEmailEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.ciphertext === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.authTag === "string" &&
    typeof candidate.keyVersion === "string";
}

export function readStudentEmail(
  encrypted: unknown,
  legacyPlaintext: unknown,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (isStudentEmailEnvelope(encrypted)) return decryptStudentEmail(encrypted, env);
  return typeof legacyPlaintext === "string" && legacyPlaintext.trim()
    ? normalizeStudentEmail(legacyPlaintext)
    : null;
}

/**
 * Display-path variant of `readStudentEmail`.
 *
 * A row encrypted under a key version that has been retired from the ring, or a
 * corrupted ciphertext, must not take down a whole staff list or detail page —
 * the rest of the case is still readable. The failure is reported to `onError`
 * so the caller can log it with the record id (never the decrypted value).
 * Write paths still use the strict version and fail loudly.
 */
export function readStudentEmailSafe(
  encrypted: unknown,
  legacyPlaintext: unknown,
  onError?: (error: unknown) => void,
  env: NodeJS.ProcessEnv = process.env,
) {
  try {
    return readStudentEmail(encrypted, legacyPlaintext, env);
  } catch (error) {
    onError?.(error);
    return null;
  }
}

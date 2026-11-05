import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_VERSION_PATTERN = /^v[1-9]\d*$/;
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const AAD_PREFIX = "support-library:access-email";

export type AccessEmailEncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

function parseKeyring(value: string | undefined) {
  if (!value) throw new Error("ACCESS_EMAIL_ENCRYPTION_KEYS is required");
  const keys = new Map<string, Buffer>();
  for (const entry of value.split(",")) {
    const separator = entry.indexOf(":");
    const version = entry.slice(0, separator).trim();
    const encoded = entry.slice(separator + 1).trim();
    if (separator < 1 || !KEY_VERSION_PATTERN.test(version) || !BASE64_KEY_PATTERN.test(encoded)) {
      throw new Error("ACCESS_EMAIL_ENCRYPTION_KEYS must use vN:<32-byte-base64>[,...] format");
    }
    if (keys.has(version)) throw new Error(`Duplicate access email key version ${version}`);
    const key = Buffer.from(encoded, "base64");
    if (key.length !== KEY_BYTES) throw new Error("Access email keys must decode to 32 bytes");
    keys.set(version, key);
  }
  return keys;
}

function config(env: NodeJS.ProcessEnv = process.env) {
  const activeVersion = env.ACCESS_EMAIL_KEY_VERSION?.trim() ?? "";
  if (!KEY_VERSION_PATTERN.test(activeVersion)) {
    throw new Error("ACCESS_EMAIL_KEY_VERSION must use vN format");
  }
  const keys = parseKeyring(env.ACCESS_EMAIL_ENCRYPTION_KEYS);
  if (!keys.has(activeVersion)) throw new Error(`Active access email key ${activeVersion} is missing`);
  return { activeVersion, keys };
}

function aad(jobId: string, requestId: string, notificationType: string, keyVersion: string) {
  return Buffer.from(
    `${AAD_PREFIX}:${jobId}:${requestId}:${notificationType}:${keyVersion}`,
    "utf8",
  );
}

export function encryptAccessEmailPayload(
  plaintext: string,
  binding: { jobId: string; requestId: string; notificationType: string },
  env: NodeJS.ProcessEnv = process.env,
): AccessEmailEncryptedPayload {
  const { activeVersion, keys } = config(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keys.get(activeVersion)!, iv);
  cipher.setAAD(aad(binding.jobId, binding.requestId, binding.notificationType, activeVersion));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: activeVersion,
  };
}

export function decryptAccessEmailPayload(
  envelope: AccessEmailEncryptedPayload,
  binding: { jobId: string; requestId: string; notificationType: string },
  env: NodeJS.ProcessEnv = process.env,
) {
  const { keys } = config(env);
  const key = keys.get(envelope.keyVersion);
  if (!key) throw new Error(`Unknown access email key version ${envelope.keyVersion}`);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(aad(binding.jobId, binding.requestId, binding.notificationType, envelope.keyVersion));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Access email payload authentication failed");
  }
}

export function validateAccessEmailKeyring(env: NodeJS.ProcessEnv = process.env) {
  config(env);
}

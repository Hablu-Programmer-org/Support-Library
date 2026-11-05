// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  decryptAccessEmailPayload,
  encryptAccessEmailPayload,
  validateAccessEmailKeyring,
} from "@/lib/access-email-payload-crypto";

const env: NodeJS.ProcessEnv = {
  ...process.env,
  ACCESS_EMAIL_KEY_VERSION: "v1",
  ACCESS_EMAIL_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 7).toString("base64")}`,
};
const binding = {
  jobId: "507f1f77bcf86cd799439011",
  requestId: "507f1f77bcf86cd799439012",
  notificationType: "N8N_ACCESS",
};

describe("access email payload crypto", () => {
  it("round-trips a link without putting plaintext in the envelope", () => {
    const link = "https://n8n.hablu-programmer.com/invite/secret-token";
    const encrypted = encryptAccessEmailPayload(link, binding, env);

    expect(JSON.stringify(encrypted)).not.toContain("secret-token");
    expect(decryptAccessEmailPayload(encrypted, binding, env)).toBe(link);
  });

  it("binds ciphertext to the job, request and notification type", () => {
    const encrypted = encryptAccessEmailPayload("https://example.com/secret", binding, env);

    expect(() => decryptAccessEmailPayload(encrypted, {
      ...binding,
      requestId: "507f1f77bcf86cd799439099",
    }, env)).toThrow(/authentication failed/i);
  });

  it("rejects tampering and missing active keys", () => {
    const encrypted = encryptAccessEmailPayload("secret", binding, env);
    encrypted.ciphertext = `${encrypted.ciphertext.slice(0, -2)}AA`;
    expect(() => decryptAccessEmailPayload(encrypted, binding, env)).toThrow(/authentication failed/i);
    expect(() => validateAccessEmailKeyring({
      ...process.env,
      ACCESS_EMAIL_KEY_VERSION: "v2",
      ACCESS_EMAIL_ENCRYPTION_KEYS: env.ACCESS_EMAIL_ENCRYPTION_KEYS,
    })).toThrow(/missing/i);
  });
});

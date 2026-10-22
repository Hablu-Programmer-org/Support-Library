// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const env = {
  NODE_ENV: "test",
  STUDENT_EMAIL_KEY_VERSION: "v1",
  STUDENT_EMAIL_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString("base64")}`,
  STUDENT_EMAIL_LOOKUP_KEYS: `v1:${Buffer.alloc(32, 2).toString("base64")}`,
} as NodeJS.ProcessEnv;

let crypto: typeof import("@/lib/student-email-crypto");
let migration: typeof import("@/lib/student-email-migration");

beforeAll(async () => {
  crypto = await import("@/lib/student-email-crypto");
  migration = await import("@/lib/student-email-migration");
});

describe("student email cryptography", () => {
  it("encrypts and decrypts a normalized email without storing plaintext", () => {
    const envelope = crypto.encryptStudentEmail(" Student@Example.COM ", env);

    expect(envelope.ciphertext).not.toContain("student@example.com");
    expect(envelope.keyVersion).toBe("v1");
    expect(crypto.decryptStudentEmail(envelope, env)).toBe("student@example.com");
  });

  it("rejects tampered authenticated ciphertext", () => {
    const envelope = crypto.encryptStudentEmail("student@example.com", env);
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    ciphertext[0] ^= 1;

    expect(() => crypto.decryptStudentEmail({
      ...envelope,
      ciphertext: ciphertext.toString("base64"),
    }, env)).toThrow("authentication failed");
  });

  it("creates deterministic normalized HMAC lookup values", () => {
    const first = crypto.createStudentEmailLookup("Student@Example.com", env);
    const second = crypto.createStudentEmailLookup(" student@example.COM ", env);

    expect(first).toEqual(second);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.digest).not.toContain("student@example.com");
  });

  it("can read legacy plaintext only when no encrypted envelope exists", () => {
    expect(crypto.readStudentEmail(undefined, " Legacy@Example.COM ", env)).toBe("legacy@example.com");
  });
});

describe("readStudentEmailSafe (display path)", () => {
  const envelopeWithRetiredKey = {
    ciphertext: "AAAA",
    iv: "BBBB",
    authTag: "CCCC",
    keyVersion: "v99",
  };

  it("returns the email when the envelope decrypts", () => {
    const protectedEmail = crypto.protectStudentEmail("student@example.com", env);
    expect(
      crypto.readStudentEmailSafe(protectedEmail.encrypted, undefined, undefined, env),
    ).toBe("student@example.com");
  });

  it("returns null and reports the failure for a retired key version", () => {
    const onError = vi.fn();

    // A single unreadable row must not take down a staff page: the rest of the
    // case stays readable and the failure is logged with the record id.
    expect(
      crypto.readStudentEmailSafe(envelopeWithRetiredKey, undefined, onError, env),
    ).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("still reads the legacy plaintext when there is no envelope", () => {
    expect(crypto.readStudentEmailSafe(undefined, " Legacy@Example.COM ")).toBe(
      "legacy@example.com",
    );
  });
});

describe("student email migration helpers", () => {
  it("classifies complete records as idempotent no-ops", () => {
    const protectedEmail = crypto.protectStudentEmail("student@example.com", env);
    expect(migration.classifyStudentEmailRecord({
      _id: "issue-1",
      studentEmailEncrypted: protectedEmail.encrypted,
      studentEmailLookup: protectedEmail.lookup,
    })).toBe("complete");
  });

  it("builds a source-value condition and removes both legacy fields", () => {
    const record = {
      _id: "issue-1",
      studentEmail: "student@example.com",
      studentEmailHash: "legacy-bcrypt-value",
    };
    const update = migration.protectedStudentEmailUpdate(record.studentEmail, env);

    expect(migration.legacyStudentEmailCondition(record)).toEqual(record);
    expect(update.$unset).toEqual({ studentEmail: "", studentEmailHash: "" });
    expect(JSON.stringify(update)).not.toContain(record.studentEmail);
  });

  it("reports null and missing legacy values without attempting encryption", () => {
    expect(migration.classifyStudentEmailRecord({ _id: "one", studentEmail: null })).toBe("missing");
    expect(migration.classifyStudentEmailRecord({ _id: "two" })).toBe("missing");
  });
});

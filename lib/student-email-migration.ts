import {
  isStudentEmailEnvelope,
  protectStudentEmail,
} from "./student-email-crypto";

export type StudentEmailMigrationRecord = {
  _id: unknown;
  studentEmail?: unknown;
  studentEmailHash?: unknown;
  studentEmailEncrypted?: unknown;
  studentEmailLookup?: unknown;
};

const hasOwn = (record: object, field: string) => Object.prototype.hasOwnProperty.call(record, field);

export function hasValidStudentEmailLookup(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const lookup = value as Record<string, unknown>;
  return typeof lookup.digest === "string" && /^[a-f0-9]{64}$/.test(lookup.digest) &&
    typeof lookup.keyVersion === "string" && /^v[1-9]\d*$/.test(lookup.keyVersion);
}

export function legacyStudentEmailCondition(record: StudentEmailMigrationRecord) {
  return {
    _id: record._id,
    ...(hasOwn(record, "studentEmail") ? { studentEmail: record.studentEmail } : {}),
    ...(hasOwn(record, "studentEmailHash") ? { studentEmailHash: record.studentEmailHash } : {}),
  };
}

export function protectedStudentEmailUpdate(email: string, env: NodeJS.ProcessEnv = process.env) {
  const protectedEmail = protectStudentEmail(email, env);
  return {
    $set: {
      studentEmailEncrypted: protectedEmail.encrypted,
      studentEmailLookup: protectedEmail.lookup,
    },
    $unset: { studentEmail: "", studentEmailHash: "" },
  };
}

export function classifyStudentEmailRecord(record: StudentEmailMigrationRecord) {
  const hasEncrypted = hasOwn(record, "studentEmailEncrypted");
  if (hasEncrypted && !isStudentEmailEnvelope(record.studentEmailEncrypted)) return "invalid" as const;
  if (hasEncrypted) {
    return hasValidStudentEmailLookup(record.studentEmailLookup) &&
      !hasOwn(record, "studentEmail") &&
      !hasOwn(record, "studentEmailHash")
      ? "complete" as const
      : "encrypted-needs-update" as const;
  }
  if (typeof record.studentEmail === "string" && record.studentEmail.trim()) return "plaintext" as const;
  if (record.studentEmail !== null && record.studentEmail !== undefined) return "invalid" as const;
  return "missing" as const;
}

export function encryptedSourceCondition(_id: unknown, envelope: unknown) {
  if (!isStudentEmailEnvelope(envelope)) throw new Error("Invalid encrypted student email source");
  return { _id, studentEmailEncrypted: envelope };
}

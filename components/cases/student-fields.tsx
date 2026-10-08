"use client";

import { Chip, Input } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { lookupLmsStudentAction } from "@/actions/lms";

type LookupState = "idle" | "checking" | "found" | "notFound";

/**
 * Student identity fields for the case form.
 *
 * The email is matched against the main hp-v2 database while typing; a match
 * prefills the student name (and keeps the hp-v2 user id for the case). No
 * match is fine - the name can still be typed manually.
 *
 * When `hideWhenFound` is true (create form minimal mode), the name input
 * disappears once the LMS lookup succeeds — the value is still submitted via
 * a hidden input so the snapshot is preserved.
 */
export function StudentFields({
  initialName,
  initialEmail,
  initialLmsUserId,
  hideWhenFound = false,
}: {
  initialName?: string;
  initialEmail?: string;
  initialLmsUserId?: string | null;
  hideWhenFound?: boolean;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [lmsUserId, setLmsUserId] = useState(initialLmsUserId ?? "");
  const [lookup, setLookup] = useState<LookupState>("idle");
  const nameTouchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const normalized = email.trim().toLowerCase();
    setLmsUserId("");
    if (normalized.length < 5) {
      setLookup("idle");
      return;
    }

    setLookup("checking");
    const timer = setTimeout(() => {
      void lookupLmsStudentAction(normalized).then((match) => {
        if (cancelled) return;
        if (!match) {
          setLookup("notFound");
          setLmsUserId("");
          return;
        }

        setLookup("found");
        setLmsUserId(match.userId);
        if (!nameTouchedRef.current) setName(match.name);
      }).catch(() => {
        if (!cancelled) setLookup("notFound");
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email]);

  const lookupHint =
    lookup === "checking" ? (
      <span className="text-slate-500 dark:text-slate-400">Searching the LMS…</span>
    ) : lookup === "found" ? (
      <Chip size="sm" variant="flat" color="success">
        Found in LMS
      </Chip>
    ) : lookup === "notFound" ? (
      <span className="text-amber-600 dark:text-amber-400">
        No matching LMS user found. Enter the name manually.
      </span>
    ) : null;

  // In minimal create form, hide the name input once LMS match is found
  // (unless the user manually edited it first — then keep it visible).
  const showNameInput = !hideWhenFound || lookup !== "found" || nameTouchedRef.current || name.trim().length < 2;

  return (
    <>
      {showNameInput ? (
        <Input
          name="studentName"
          label="Student Name"
          value={name}
          onValueChange={(value) => {
            setName(value);
            nameTouchedRef.current = true;
          }}
          isRequired
          minLength={2}
          maxLength={120}
        />
      ) : (
        // Hidden input preserves the snapshot value when name field is hidden
        <input type="hidden" name="studentName" value={name} />
      )}
      <div className="flex flex-col gap-1">
        <Input
          name="studentEmail"
          label="Student Email"
          type="email"
          value={email}
          onValueChange={setEmail}
          isRequired
          maxLength={160}
          description="Enter an LMS email to fill in the name automatically."
        />
        <div className="min-h-5 text-xs">{lookupHint}</div>
      </div>
      <input type="hidden" name="lmsUserId" value={lmsUserId} />
    </>
  );
}

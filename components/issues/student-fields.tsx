"use client";

import { useEffect, useRef, useState } from "react";

import { lookupLmsStudentAction } from "@/actions/lms";
import { nativeFieldClass, nativeLabelClass } from "@/lib/config/fields";

type LookupState = "idle" | "checking" | "found" | "notFound";

/**
 * Student identity fields for the issue form.
 *
 * The email is matched against the main hp-v2 database while typing; a match
 * prefills the student name (and keeps the hp-v2 user id for the issue). No
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
  const [nameTouched, setNameTouched] = useState(false);
  const nameTouchedRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hydratedEmail = emailRef.current?.value ?? "";
    if (!hydratedEmail || hydratedEmail === email) return;

    const timer = setTimeout(() => {
      setEmail(hydratedEmail);
      setLmsUserId("");
      setLookup(hydratedEmail.trim().length < 5 ? "idle" : "checking");
    }, 0);

    return () => clearTimeout(timer);
  }, [email]);

  useEffect(() => {
    let cancelled = false;
    const normalized = email.trim().toLowerCase();
    if (normalized.length < 5) {
      return;
    }

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
      <span className="inline-flex w-fit rounded-full bg-success-100 px-2 py-1 text-xs font-medium text-success-700 dark:bg-success-950/50 dark:text-success-200">
        Found in LMS
      </span>
    ) : lookup === "notFound" ? (
      <span className="text-amber-600 dark:text-amber-400">
        No matching LMS user found. Enter the name manually.
      </span>
    ) : null;

  // In minimal create form, hide the name input once LMS match is found
  // (unless the user manually edited it first — then keep it visible).
  const showNameInput = !hideWhenFound || lookup !== "found" || nameTouched || name.trim().length < 2;

  return (
    <>
      {showNameInput ? (
        <label className={nativeLabelClass}>
          <span className="flex items-center gap-1">
            Student Name <span className="text-danger" aria-hidden="true">*</span>
          </span>
          <input
            className={nativeFieldClass}
            name="studentName"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              nameTouchedRef.current = true;
              setNameTouched(true);
            }}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
      ) : (
        // Hidden input preserves the snapshot value when name field is hidden
        <input type="hidden" name="studentName" value={name} />
      )}
      <div className="flex flex-col gap-1">
        <label className={nativeLabelClass}>
          <span className="flex items-center gap-1">
            Student Email <span className="text-danger" aria-hidden="true">*</span>
          </span>
          <input
            className={nativeFieldClass}
            name="studentEmail"
            type="email"
            defaultValue={email}
            ref={emailRef}
            onInput={(event) => {
              const value = event.currentTarget.value;
              setEmail(value);
              setLmsUserId("");
              setLookup(value.trim().length < 5 ? "idle" : "checking");
            }}
            required
            maxLength={160}
          />
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            Enter an LMS email to fill in the name automatically.
          </span>
        </label>
        <div className="min-h-5 text-xs">{lookupHint}</div>
      </div>
      <input type="hidden" name="lmsUserId" value={lmsUserId} />
    </>
  );
}
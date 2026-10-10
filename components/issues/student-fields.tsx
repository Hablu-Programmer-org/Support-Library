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
 * When LMS match is found, the name field is auto-filled and disabled.
 */
export function StudentFields({
  name,
  email,
  lmsUserId,
  nameError,
  emailError,
  onNameChange,
  onEmailChange,
  onLmsUserIdChange,
}: {
  name: string;
  email: string;
  lmsUserId: string;
  nameError?: string;
  emailError?: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onLmsUserIdChange: (value: string) => void;
}) {
  const [lookup, setLookup] = useState<LookupState>("idle");
  const [nameTouched, setNameTouched] = useState(false);
  const nameTouchedRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hydratedEmail = emailRef.current?.value ?? "";
    if (!hydratedEmail || hydratedEmail === email) return;

    const timer = setTimeout(() => {
      onEmailChange(hydratedEmail);
      onLmsUserIdChange("");
      setLookup(hydratedEmail.trim().length < 5 ? "idle" : "checking");
    }, 0);

    return () => clearTimeout(timer);
  }, [email, onEmailChange, onLmsUserIdChange]);

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
          onLmsUserIdChange("");
          return;
        }

        setLookup("found");
        onLmsUserIdChange(match.userId);
        if (!nameTouchedRef.current) onNameChange(match.name);
      }).catch(() => {
        if (!cancelled) setLookup("notFound");
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email, onNameChange, onLmsUserIdChange]);

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

  // Name field is always visible; disabled when LMS match is found (unless user edited it)
  const isNameDisabled = lookup === "found" && !nameTouched && name.trim().length >= 2;

  return (
    <>
      <label className={nativeLabelClass}>
        <span className="flex items-center gap-1">
          Student Name <span className="text-danger" aria-hidden="true">*</span>
        </span>
        <input
          className={nativeFieldClass}
          name="studentName"
          value={name}
          onChange={(event) => {
            onNameChange(event.target.value);
            nameTouchedRef.current = true;
            setNameTouched(true);
          }}
          required
          minLength={2}
          maxLength={120}
          disabled={isNameDisabled}
          aria-disabled={isNameDisabled}
          aria-invalid={nameError ? "true" : "false"}
        />
        {isNameDisabled && (
          <input type="hidden" name="studentName" value={name} />
        )}
        {isNameDisabled && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Auto-filled from LMS
          </span>
        )}
        {nameError && (
          <span className="text-sm text-danger-600 dark:text-danger-400" role="alert">
            {nameError}
          </span>
        )}
      </label>
      <div className="flex flex-col gap-1">
        <label className={nativeLabelClass}>
          <span className="flex items-center gap-1">
            Student Email <span className="text-danger" aria-hidden="true">*</span>
          </span>
          <input
            className={nativeFieldClass}
            name="studentEmail"
            type="email"
            value={email}
            ref={emailRef}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (lookup === "found" && !nameTouchedRef.current) {
                onNameChange("");
              }
              onEmailChange(value);
              onLmsUserIdChange("");
              setLookup(value.trim().length < 5 ? "idle" : "checking");
            }}
            required
            maxLength={160}
            aria-invalid={emailError ? "true" : "false"}
          />
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            Enter an LMS email to fill in the name automatically.
          </span>
          {emailError && (
            <span className="text-sm text-danger-600 dark:text-danger-400" role="alert">
              {emailError}
            </span>
          )}
        </label>
        <div className="min-h-5 text-xs">{lookupHint}</div>
      </div>
      <input type="hidden" name="lmsUserId" value={lmsUserId} />
    </>
  );
}

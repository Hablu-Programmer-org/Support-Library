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
 */
export function StudentFields({
  initialName,
  initialEmail,
  initialLmsUserId,
}: {
  initialName?: string;
  initialEmail?: string;
  initialLmsUserId?: string | null;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [lmsUserId, setLmsUserId] = useState(initialLmsUserId ?? "");
  const [lookup, setLookup] = useState<LookupState>("idle");
  const nameTouchedRef = useRef(false);

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    if (normalized.length < 5) {
      setLookup("idle");
      return;
    }

    setLookup("checking");
    const timer = setTimeout(() => {
      void lookupLmsStudentAction(normalized).then((match) => {
        if (!match) {
          setLookup("notFound");
          setLmsUserId("");
          return;
        }

        setLookup("found");
        setLmsUserId(match.userId);
        if (!nameTouchedRef.current) setName(match.name);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [email]);

  const lookupHint =
    lookup === "checking" ? (
      <span className="text-slate-500 dark:text-slate-400">LMS-এ খুঁজছি…</span>
    ) : lookup === "found" ? (
      <Chip size="sm" variant="flat" color="success">
        LMS-এ আছে
      </Chip>
    ) : lookup === "notFound" ? (
      <span className="text-amber-600 dark:text-amber-400">
        LMS-এ পাওয়া যায়নি — নাম ম্যানুয়ালি বসাও
      </span>
    ) : null;

  return (
    <>
      <Input
        name="studentName"
        label="স্টুডেন্ট নাম"
        value={name}
        onValueChange={(value) => {
          setName(value);
          nameTouchedRef.current = true;
        }}
        isRequired
        minLength={2}
        maxLength={120}
      />
      <div className="flex flex-col gap-1">
        <Input
          name="studentEmail"
          label="স্টুডেন্ট ইমেইল"
          type="email"
          value={email}
          onValueChange={setEmail}
          isRequired
          maxLength={160}
          description="LMS ইমেইল দিলে নাম নিজে এসে যাবে"
        />
        <div className="min-h-5 text-xs">{lookupHint}</div>
      </div>
      <input type="hidden" name="lmsUserId" value={lmsUserId} />
    </>
  );
}
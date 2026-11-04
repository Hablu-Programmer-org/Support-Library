"use client";

import Image from "next/image";
import { useState } from "react";

const PROFILE_IMAGE_HOSTS = new Set(["lh3.googleusercontent.com"]);

/** Match Next's deliberately narrow remote image policy before rendering. */
export function safeProfileImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PROFILE_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function profileInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

export function ProfileAvatar({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string | null;
}) {
  const safeUrl = safeProfileImageUrl(imageUrl);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = safeUrl !== null && safeUrl !== failedUrl;

  return (
    <span
      aria-hidden="true"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
    >
      {showImage ? (
        <Image
          alt=""
          className="h-full w-full object-cover"
          height={36}
          onError={() => setFailedUrl(safeUrl)}
          sizes="36px"
          src={safeUrl}
          width={36}
        />
      ) : (
        profileInitials(name)
      )}
    </span>
  );
}

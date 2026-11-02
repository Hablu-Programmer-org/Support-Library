"use client";

import { signIn } from "next-auth/react";

export function GoogleReverifyButton() {
  return (
    <button
      type="button"
      onClick={() => signIn(
        "google",
        { callbackUrl: "/dashboard/access-requests" },
        { prompt: "select_account", max_age: "0" },
      )}
      className="inline-flex items-center justify-center rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
    >
      Verify with Google
    </button>
  );
}

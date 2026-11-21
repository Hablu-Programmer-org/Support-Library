"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SearchIcon } from "@/components/icons";

// The landing search is the page's main action, so it is larger than the
// shared nativeFieldClass: 48px touch target, icon inside, and one focus ring on
// the whole bar (focus-within) instead of on the bare input.
const barClass =
  "glass flex w-full max-w-xl flex-col gap-2 rounded-2xl p-2 ring-cyan-500/50 focus-within:ring-2 sm:flex-row sm:items-center";

const inputClass =
  "h-12 w-full rounded-xl bg-transparent pl-11 pr-3 text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm dark:text-white dark:placeholder:text-slate-500 [&::-webkit-search-cancel-button]:cursor-pointer";

const buttonClass =
  "brand-bg h-12 shrink-0 rounded-xl px-6 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500";

export function LibrarySearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    router.push(`/dashboard/issues?q=${encodeURIComponent(query)}`);
  };

  return (
    <form role="search" className={barClass} onSubmit={submit}>
      <div className="relative flex-1">
        <SearchIcon
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        />
        <input
          aria-label="Search published answers"
          className={inputClass}
          enterKeyHint="search"
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search published answers..."
          type="search"
          value={term}
        />
      </div>
      <button className={buttonClass} type="submit">
        Search
      </button>
    </form>
  );
}

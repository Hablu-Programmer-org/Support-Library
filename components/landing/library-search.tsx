"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { nativeFieldClass } from "@/lib/config/fields";

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
    <form
      role="search"
      className="glass flex w-full max-w-xl flex-col gap-2 rounded-2xl p-2 sm:flex-row"
      onSubmit={submit}
    >
      <input
        aria-label="Search published solutions"
        className={nativeFieldClass}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search published solutions..."
        type="search"
        value={term}
      />
      <button
        className="brand-bg rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
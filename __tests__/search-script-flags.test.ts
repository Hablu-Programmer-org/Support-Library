/**
 * The ops scripts are entrypoints (they execute `main()` when run directly),
 * so the only layer worth pinning is the safety-critical flag parsing:
 * write modes must never be reachable without their confirmations, and a
 * dry run must stay the default.
 */
import { describe, expect, it } from "vitest";

import { parseBackfillFlags } from "../scripts/backfill-search-text";
import { parseSearchIndexFlags } from "../scripts/search-indexes";

const argv = (...args: string[]) => ["node", "script.ts", ...args];

describe("parseBackfillFlags", () => {
  it("defaults to a dry run", () => {
    expect(parseBackfillFlags(argv())).toEqual({
      apply: false,
      verify: false,
      confirmation: undefined,
    });
  });

  it("requires the database-name confirmation with --apply", () => {
    expect(parseBackfillFlags(argv("--apply", "--confirm=support_library"))).toEqual({
      apply: true,
      verify: false,
      confirmation: "support_library",
    });
  });

  it("keeps --verify separate from --apply", () => {
    expect(parseBackfillFlags(argv("--verify"))).toEqual({
      apply: false,
      verify: true,
      confirmation: undefined,
    });
  });
});

describe("parseSearchIndexFlags", () => {
  it("defaults to print mode with a 180s verify timeout", () => {
    const parsed = parseSearchIndexFlags(argv());

    expect(parsed.flags.size).toBe(0);
    expect(parsed.confirmation).toBeUndefined();
    expect(parsed.timeoutSeconds).toBe(180);
  });

  it("carries --verify/--wait and an explicit timeout", () => {
    const parsed = parseSearchIndexFlags(argv("--verify", "--wait", "--timeout=30"));

    expect(parsed.flags.has("--verify")).toBe(true);
    expect(parsed.flags.has("--wait")).toBe(true);
    expect(parsed.timeoutSeconds).toBe(30);
  });

  it("carries --apply/--yes/--confirm for the write path", () => {
    const parsed = parseSearchIndexFlags(argv("--apply", "--yes", "--confirm=support_library"));

    expect(parsed.flags.has("--apply")).toBe(true);
    expect(parsed.flags.has("--yes")).toBe(true);
    expect(parsed.confirmation).toBe("support_library");
  });
});

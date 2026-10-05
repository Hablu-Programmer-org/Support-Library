import path from "path";

import dotenv from "dotenv";

const envPath = path.resolve(__dirname, "../../.env.local");

export type E2EDatabase = {
  /** Development database name, or undefined when it could not be resolved. */
  devDb: string | undefined;
  /** Dedicated database name that E2E is allowed to write to and drop. */
  testDb: string;
};

/**
 * Resolves the database name Playwright should use.
 *
 * `playwright.config.ts` calls this before overriding `MONGODB_DB`, and pins the
 * result into `MONGODB_DEV_DB` / `MONGODB_TEST_DB` so that global teardown - which
 * may run in a separate loader context - resolves the exact same name instead of
 * re-deriving it from the already-overridden value.
 */
export function resolveE2EDatabase(): E2EDatabase {
  dotenv.config({ path: envPath });

  const pinnedDevDb = process.env.MONGODB_DEV_DB;
  const devDb =
    (pinnedDevDb === undefined ? process.env.MONGODB_DB : pinnedDevDb)?.trim() || undefined;
  const testDb =
    process.env.MONGODB_TEST_DB?.trim() || (devDb ? `${devDb}_e2e` : "");

  if (!testDb) {
    throw new Error(
      "Cannot resolve an E2E database. Set MONGODB_DB or MONGODB_TEST_DB in .env.local.",
    );
  }

  if (devDb && testDb === devDb) {
    throw new Error(
      `Refusing to run E2E: MONGODB_TEST_DB ("${testDb}") must not equal MONGODB_DB ("${devDb}").`,
    );
  }

  return { devDb, testDb };
}
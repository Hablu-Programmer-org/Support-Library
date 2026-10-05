import mongoose from "mongoose";

import { resolveE2EDatabase } from "./fixtures/test-db";

/**
 * Clears the dedicated E2E database after a run.
 *
 * Deletes documents collection by collection instead of calling `dropDatabase`,
 * because the app's MongoDB user is provisioned with read/write only and is not
 * allowed to drop databases.
 *
 * `resolveE2EDatabase` throws when the E2E database would resolve to the
 * development database, so this can never touch real dev data.
 */
export default async function globalTeardown() {
  const { testDb } = resolveE2EDatabase();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing. Cannot tear down the E2E database.");
  }

  const connection = await mongoose
    .createConnection(uri, {
      dbName: testDb,
      serverSelectionTimeoutMS: 10_000,
    })
    .asPromise();

  try {
    const collections = await connection.db!.collections();
    await Promise.all(
      collections.map((collection) => collection.deleteMany({})),
    );
  } finally {
    await connection.close();
  }
}
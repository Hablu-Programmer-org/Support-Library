import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { RateLimitBucketModel } from "../models";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  await dbConnect();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    await RateLimitBucketModel.create([{
      key: `deployment-preflight:${Date.now()}`,
      count: 1,
      expiresAt: new Date(Date.now() + 60_000),
    }], { session });
    await session.abortTransaction();
    console.info("[db:preflight] read, write, and transaction checks passed");
  } finally {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("[db:preflight] failed", error);
  process.exit(1);
});

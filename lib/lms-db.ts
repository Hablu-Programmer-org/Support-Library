import { MongoClient } from "mongodb";

type LmsMongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

const globalForLmsMongo = globalThis as unknown as { __slLmsMongo?: LmsMongoCache };
const cache = (globalForLmsMongo.__slLmsMongo ??= { client: null, promise: null });

const getLmsMongoUri = () => {
  const uri = process.env.LMS_MONGODB_URI ||
    (process.env.NODE_ENV === "production" ? undefined : process.env.MONGODB_URI);
  if (!uri) throw new Error("LMS_MONGODB_URI is missing");
  return uri;
};

export async function getLmsMongoClient() {
  if (cache.client) return cache.client;

  cache.promise ??= new MongoClient(getLmsMongoUri(), {
    serverSelectionTimeoutMS: 10_000,
  }).connect();

  try {
    cache.client = await cache.promise;
    return cache.client;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}

export async function checkLmsReadiness() {
  const client = await getLmsMongoClient();
  const dbName = process.env.LMS_MONGODB_DB;
  if (!dbName) throw new Error("LMS_MONGODB_DB is missing");

  await client.db(dbName).collection("User").findOne({}, { projection: { _id: 1 }, maxTimeMS: 2_000 });
}

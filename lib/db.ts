import mongoose from "mongoose";

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Copy .env.example to .env.local and set it.",
    );
  }
  return uri;
};

const getMongoDbName = () => {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) {
    throw new Error(
      "MONGODB_DB is missing. Copy .env.example to .env.local and set it.",
    );
  }
  return dbName;
};

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { __slMongoose?: MongooseCache };
const cache = (globalForMongoose.__slMongoose ??= { conn: null, promise: null });

export const dbConnect = async (): Promise<typeof mongoose> => {
  if (cache.conn) return cache.conn;

  cache.promise ??= mongoose.connect(getMongoUri(), {
    dbName: getMongoDbName(),
    bufferCommands: false,
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
};

export const checkSupportReadiness = async () => {
  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Support database is unavailable");
  await db.admin().ping();
  await db.collection("staff_users").findOne({}, { projection: { _id: 1 }, maxTimeMS: 2_000 });
};

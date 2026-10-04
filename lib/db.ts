import "server-only";

import type { MongoClient } from "mongodb";
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
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    cachedClient = null;
    throw error;
  }

  return cache.conn;
};

let cachedClient: MongoClient | null = null;

export const getMongoClient = async (): Promise<MongoClient> => {
  if (cachedClient) return cachedClient;

  await dbConnect();
  cachedClient = mongoose.connection.getClient() as unknown as MongoClient;

  if (!cachedClient) {
    throw new Error("MongoDB client not available after connection.");
  }

  return cachedClient;
};

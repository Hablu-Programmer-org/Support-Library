import type { MongoClient } from "mongodb";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is missing. Copy .env.example to .env.local and set it.",
  );
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { __slMongoose?: MongooseCache };
const cache = (globalForMongoose.__slMongoose ??= { conn: null, promise: null });

export const dbConnect = async (): Promise<typeof mongoose> => {
  if (cache.conn) return cache.conn;

  cache.promise ??= mongoose.connect(MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB,
    bufferCommands: false,
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
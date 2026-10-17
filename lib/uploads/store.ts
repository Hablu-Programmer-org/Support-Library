import "server-only";

import { AwsClient } from "aws4fetch";
import { createCloudinaryStore, readCloudinaryConfig } from "./cloudinary";

/**
 * Upload object storage.
 *
 * Backends, chosen by `UPLOAD_STORAGE`:
 *
 * - `r2`         — Cloudflare R2 over its S3 API, signed with SigV4 (`aws4fetch`).
 * - `cloudinary` — authenticated Cloudinary images, signed server-side.
 * - `memory`     — a process-local `Map`, for development and E2E only. Objects
 *                  are lost on restart and are not shared between instances.
 *
 * The store is always private: nothing is served straight from it. Downloads go
 * through `/api/attachments/[id]`, which authorizes the session before streaming
 * bytes, so no object key or id ever leaks to the client.
 *
 * `UPLOAD_STORAGE` is unset by default, which means *disabled*: an unconfigured
 * deployment must never silently accept files it cannot store. Development and
 * test runs default to `memory` so the feature is usable without credentials.
 */

export type UploadStorageMode = "disabled" | "memory" | "r2" | "cloudinary";

export type StoredObject = {
  body: Uint8Array;
  contentType: string;
};

export interface UploadStore {
  readonly mode: Exclude<UploadStorageMode, "disabled">;
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

export type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Reads the R2 settings, or `null` when any required value is missing. */
export function readR2Config(): R2Config | null {
  const accountId = (process.env.R2_ACCOUNT_ID ?? "").trim();
  const bucket = (process.env.R2_BUCKET ?? "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();
  const configuredEndpoint = (process.env.R2_ENDPOINT ?? "").trim();

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;

  const endpoint = configuredEndpoint || `https://${accountId}.r2.cloudflarestorage.com`;
  return { endpoint: endpoint.replace(/\/+$/, ""), bucket, accessKeyId, secretAccessKey };
}

/** Resolves the effective storage backend for this process. */
export function uploadStorageMode(): UploadStorageMode {
  const raw = (process.env.UPLOAD_STORAGE ?? "").trim().toLowerCase();
  if (raw === "r2") return readR2Config() ? "r2" : "disabled";
  if (raw === "cloudinary") return readCloudinaryConfig() ? "cloudinary" : "disabled";
  if (raw === "memory") return "memory";
  if (raw === "disabled") return "disabled";
  // Unset: convenient in development, never assumed in production.
  return process.env.NODE_ENV === "production" ? "disabled" : "memory";
}

export function uploadStorageEnabled(): boolean {
  return uploadStorageMode() !== "disabled";
}

type MemoryBucket = Map<string, StoredObject>;

const globalForUploads = globalThis as unknown as { __slUploadMemory?: MemoryBucket };
const memoryBucket = (globalForUploads.__slUploadMemory ??= new Map<string, StoredObject>());

const memoryStore: UploadStore = {
  mode: "memory",
  async put(key, body, contentType) {
    // Copy: the caller's buffer may be reused or mutated after the call.
    memoryBucket.set(key, { body: new Uint8Array(body), contentType });
    return key;
  },
  async get(key) {
    return memoryBucket.get(key) ?? null;
  },
  async delete(key) {
    memoryBucket.delete(key);
  },
};

/**
 * Object keys are entirely server-generated (`attachments/YYYY/MM/<uuid>.<ext>`,
 * see `lib/uploads/keys.ts`), so this only guards against a corrupted or
 * tampered key turning into an unexpected bucket path.
 */
const SAFE_OBJECT_KEY = /^[a-z0-9][a-z0-9/._-]*$/;

function createR2Store(config: R2Config): UploadStore {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });

  const objectUrl = (key: string) => {
    if (!SAFE_OBJECT_KEY.test(key) || key.includes("..")) {
      throw new Error("Invalid upload object key");
    }
    return `${config.endpoint}/${config.bucket}/${key}`;
  };

  const drain = async (response: Response) => {
    await response.text().catch(() => "");
  };

  /**
   * `aws4fetch` hashes the body itself and re-hashes it on every retry, so it
   * must receive an `ArrayBufferView`: a `Blob` has no `byteLength` and is
   * rejected outright. Node's `Buffer` is a valid view at runtime, but the DOM
   * `BodyInit` type does not admit it, so the bytes are copied into a plain
   * `Uint8Array` — which also freezes them against any later mutation.
   */
  const payload = (body: Buffer) => new Uint8Array(body);

  return {
    mode: "r2",
    async put(key, body, contentType) {
      const response = await client.fetch(objectUrl(key), {
        method: "PUT",
        body: payload(body),
        headers: { "content-type": contentType },
      });
      if (!response.ok) {
        // Drain so the connection is reusable; never surface the object key.
        await drain(response);
        throw new Error(`Upload store rejected the write (${response.status})`);
      }
      return key;
    },
    async get(key) {
      const response = await client.fetch(objectUrl(key));
      if (response.status === 404) return null;
      if (!response.ok) {
        await drain(response);
        throw new Error(`Upload store rejected the read (${response.status})`);
      }
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
      };
    },
    async delete(key) {
      const response = await client.fetch(objectUrl(key), { method: "DELETE" });
      // Deleting a missing object is indistinguishable from success in S3/R2.
      if (!response.ok && response.status !== 404) {
        await drain(response);
        throw new Error(`Upload store rejected the delete (${response.status})`);
      }
    },
  };
}

let cachedStore: { mode: UploadStorageMode; store: UploadStore | null } | null = null;

/** Returns the store for the active backend, or `null` when uploads are disabled. */
export function getUploadStore(): UploadStore | null {
  const mode = uploadStorageMode();
  if (cachedStore?.mode === mode) return cachedStore.store;
  const store =
    mode === "r2"
      ? createR2Store(readR2Config()!)
      : mode === "cloudinary"
        ? createCloudinaryStore(readCloudinaryConfig()!)
        : mode === "memory"
          ? memoryStore
          : null;
  cachedStore = { mode, store };
  return store;
}

import "server-only";

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import type { StoredObject, UploadStore } from "./store";

/** Credentials for one Cloudinary product environment. */
export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const ORIGINAL_KEY = /^(attachments\/\d{4}\/\d{2}\/[a-f0-9-]{36})\.(png|jpg|webp|gif)$/;
const STORED_KEY = /^v([1-9]\d*)\/(attachments\/\d{4}\/\d{2}\/[a-f0-9-]{36})\.(png|jpg|webp|gif)$/;
const ALLOWED_FORMATS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

type ImageFormat = "png" | "jpg" | "webp" | "gif";

type ParsedStoredKey = {
  version: number;
  publicId: string;
  format: ImageFormat;
};

class CloudinaryHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Cloudinary request failed (${status})`);
    this.name = "CloudinaryHttpError";
    this.status = status;
  }
}

/** The small SDK surface used here, injectable so tests never make network calls. */
export type CloudinaryClient = Pick<typeof cloudinary, "config" | "url" | "uploader">;

/** Reads Cloudinary credentials, or `null` when any required value is missing. */
export function readCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME ?? "").trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY ?? "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET ?? "").trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

/** Accept only versioned keys returned by this backend. */
export function isValidCloudinaryKey(key: string): boolean {
  return parseStoredKey(key) !== null;
}

function parseStoredKey(key: string): ParsedStoredKey | null {
  const match = STORED_KEY.exec(key);
  if (!match) return null;
  const version = Number(match[1]);
  if (!Number.isSafeInteger(version) || version <= 0) return null;
  return { version, publicId: match[2], format: match[3] as ImageFormat };
}

function parseOriginalKey(key: string): { publicId: string; format: ImageFormat } {
  const match = ORIGINAL_KEY.exec(key);
  if (!match) throw new Error("Invalid Cloudinary upload key");
  return { publicId: match[1], format: match[2] as ImageFormat };
}

function statusFromError(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const nested = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : null;
  const status = record.http_code ?? record.status ?? nested?.http_code ?? nested?.status;
  return typeof status === "number" ? status : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = statusFromError(error);
      if (attempt + 1 >= MAX_ATTEMPTS || (status !== null && !TRANSIENT_STATUSES.has(status))) {
        throw error;
      }
      await sleep(250);
    }
  }
  throw lastError;
}

function upload(
  client: CloudinaryClient,
  publicId: string,
  body: Buffer,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "image",
        type: "authenticated",
        public_id: publicId,
        allowed_formats: [...ALLOWED_FORMATS],
        overwrite: true,
        unique_filename: false,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (error, result) => {
        if (error) reject(error);
        else if (!result) reject(new Error("Cloudinary upload returned no result"));
        else resolve(result);
      },
    );
    stream.end(body);
  });
}

function destroy(client: CloudinaryClient, publicId: string): Promise<unknown> {
  return client.uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
    invalidate: true,
    ...{ timeout: REQUEST_TIMEOUT_MS },
  });
}

function assertUploadResult(
  result: UploadApiResponse,
  expected: { publicId: string; format: ImageFormat; bytes: number },
): { version: number; format: ImageFormat } {
  const format = result.format === "jpeg" ? "jpg" : result.format;
  if (
    result.public_id !== expected.publicId ||
    result.resource_type !== "image" ||
    result.type !== "authenticated" ||
    result.bytes !== expected.bytes ||
    format !== expected.format ||
    !Number.isSafeInteger(result.version) ||
    result.version <= 0
  ) {
    throw new Error("Cloudinary returned inconsistent upload metadata");
  }
  return { version: result.version, format: format as ImageFormat };
}

function deliveryUrl(client: CloudinaryClient, parsed: ParsedStoredKey): string {
  const value = client.url(parsed.publicId, {
    resource_type: "image",
    type: "authenticated",
    version: parsed.version,
    format: parsed.format,
    sign_url: true,
    secure: true,
  });
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") {
    throw new Error("Cloudinary generated an unexpected delivery URL");
  }
  return url.toString();
}

function mimeForFormat(format: ImageFormat): string {
  return format === "jpg" ? "image/jpeg" : `image/${format}`;
}

/**
 * Private Cloudinary-backed object store.
 *
 * Images use the `authenticated` delivery type, so neither originals nor
 * transformed variants are available without a server-generated signature.
 * The persisted key includes Cloudinary's immutable version, public id and
 * format; the browser receives only the attachment document id.
 */
export function createCloudinaryStore(
  config: CloudinaryConfig,
  client: CloudinaryClient = cloudinary,
): UploadStore {
  client.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  return {
    mode: "cloudinary",

    async put(key, body) {
      const input = parseOriginalKey(key);
      try {
        const result = await retryTransient(() => upload(client, input.publicId, body));
        const stored = assertUploadResult(result, {
          publicId: input.publicId,
          format: input.format,
          bytes: body.byteLength,
        });
        return `v${stored.version}/${input.publicId}.${stored.format}`;
      } catch (error) {
        // The provider may have accepted bytes even if its response was lost or
        // malformed. The public id is deterministic, so best-effort cleanup can
        // prevent that ambiguous result from becoming an orphan.
        await retryTransient(() => destroy(client, input.publicId)).catch(() => undefined);
        throw error;
      }
    },

    async get(key): Promise<StoredObject | null> {
      const parsed = parseStoredKey(key);
      if (!parsed) return null;

      const url = deliveryUrl(client, parsed);

      const response = await retryTransient(async () => {
        const result = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (TRANSIENT_STATUSES.has(result.status)) {
          await result.body?.cancel().catch(() => undefined);
          throw new CloudinaryHttpError(result.status);
        }
        return result;
      });
      if (response.status === 404) {
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`Cloudinary read failed (${response.status})`);
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (contentType !== mimeForFormat(parsed.format)) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("Cloudinary returned an unexpected content type");
      }
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType,
      };
    },

    async delete(key) {
      const parsed = parseStoredKey(key);
      if (!parsed) return; // legacy backend key: there is nothing here to delete
      const result = await retryTransient(() => destroy(client, parsed.publicId));
      const outcome = result && typeof result === "object"
        ? (result as Record<string, unknown>).result
        : null;
      if (outcome !== "ok" && outcome !== "not found") {
        throw new Error("Cloudinary delete returned an unexpected result");
      }
    },
  };
}

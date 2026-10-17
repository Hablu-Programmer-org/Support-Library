// @vitest-environment node
import { Writable } from "node:stream";
import type { UploadApiOptions, UploadApiResponse, UploadResponseCallback } from "cloudinary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sdk = vi.hoisted(() => ({
  config: vi.fn(),
  url: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: sdk.config,
    url: sdk.url,
    uploader: {
      upload_stream: sdk.uploadStream,
      destroy: sdk.destroy,
    },
  },
}));

const {
  createCloudinaryStore,
  isValidCloudinaryKey,
  readCloudinaryConfig,
} = await import("@/lib/uploads/cloudinary");
const { ingestUploads } = await import("@/lib/uploads/ingest");

const ENV_KEYS = [
  "UPLOAD_STORAGE",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;
const originalEnv = { ...process.env };

const config = { cloudName: "hablu", apiKey: "123456", apiSecret: "secret-value" };
const publicId = "attachments/2026/10/123e4567-e89b-42d3-a456-426614174000";
const storedKey = `v1719307544/${publicId}.png`;

function response(overrides: Partial<UploadApiResponse> = {}): UploadApiResponse {
  return {
    public_id: publicId,
    version: 1719307544,
    signature: "response-signature",
    width: 2,
    height: 3,
    format: "png",
    resource_type: "image",
    created_at: "2026-10-17T00:00:00Z",
    tags: [],
    pages: 1,
    bytes: 5,
    type: "authenticated",
    etag: "etag",
    placeholder: false,
    url: "http://example.invalid/image",
    secure_url: "https://example.invalid/image",
    access_mode: "authenticated",
    original_filename: "image",
    moderation: [],
    access_control: [],
    context: {},
    metadata: {},
    ...overrides,
  };
}

function mockUpload(result: UploadApiResponse) {
  sdk.uploadStream.mockImplementation(
    (_options: UploadApiOptions, callback: UploadResponseCallback) =>
      new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
        final(done) {
          callback(undefined, result);
          done();
        },
      }),
  );
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  vi.unstubAllGlobals();
});

describe("Cloudinary configuration and keys", () => {
  it("requires and trims the three credentials", () => {
    expect(readCloudinaryConfig()).toBeNull();
    process.env.CLOUDINARY_CLOUD_NAME = " hablu ";
    process.env.CLOUDINARY_API_KEY = " 123456 ";
    process.env.CLOUDINARY_API_SECRET = " secret-value ";
    expect(readCloudinaryConfig()).toEqual(config);
  });

  it("accepts only versioned keys produced by this backend", () => {
    expect(isValidCloudinaryKey(storedKey)).toBe(true);
    expect(isValidCloudinaryKey(`${publicId}.png`)).toBe(false);
    expect(isValidCloudinaryKey("v1/../secret.png")).toBe(false);
    expect(isValidCloudinaryKey("v0/attachments/2026/10/123e4567-e89b-42d3-a456-426614174000.png")).toBe(false);
    expect(isValidCloudinaryKey("v1/attachments/2026/10/not-a-uuid.png")).toBe(false);
  });
});

describe("Cloudinary store", () => {
  it("uploads an authenticated image and returns a versioned storage key", async () => {
    mockUpload(response());
    const store = createCloudinaryStore(config);

    await expect(store.put(`${publicId}.png`, Buffer.from("hello"), "image/png"))
      .resolves.toBe(storedKey);

    expect(sdk.config).toHaveBeenCalledWith({
      cloud_name: "hablu",
      api_key: "123456",
      api_secret: "secret-value",
      secure: true,
    });
    expect(sdk.uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: "image",
        type: "authenticated",
        public_id: publicId,
        allowed_formats: ["png", "jpg", "jpeg", "webp", "gif"],
        overwrite: true,
        unique_filename: false,
        timeout: 30_000,
      }),
      expect.any(Function),
    );
  });

  it("rejects inconsistent upload metadata instead of persisting a wrong key", async () => {
    mockUpload(response({ type: "upload" }));
    sdk.destroy.mockResolvedValue({ result: "ok" });
    const store = createCloudinaryStore(config);

    await expect(store.put(`${publicId}.png`, Buffer.from("hello"), "image/png"))
      .rejects.toThrow(/inconsistent upload metadata/i);
    expect(sdk.destroy).toHaveBeenCalledWith(publicId, expect.objectContaining({
      resource_type: "image",
      type: "authenticated",
    }));
  });

  it("reads through an SDK-signed authenticated URL", async () => {
    sdk.url.mockReturnValue("https://res.cloudinary.com/hablu/signed");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    ));
    const store = createCloudinaryStore(config);

    const object = await store.get(storedKey);
    expect(sdk.url).toHaveBeenCalledWith(publicId, {
      resource_type: "image",
      type: "authenticated",
      version: 1719307544,
      format: "png",
      sign_url: true,
      secure: true,
    });
    expect(Array.from(object!.body)).toEqual([1, 2, 3]);
    expect(object?.contentType).toBe("image/png");
  });

  it("returns null for a missing or foreign-backend key", async () => {
    sdk.url.mockReturnValue("https://res.cloudinary.com/hablu/signed");
    const fetchMock = vi.fn().mockResolvedValue(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = createCloudinaryStore(config);

    await expect(store.get(storedKey)).resolves.toBeNull();
    await expect(store.get("attachments/2026/10/legacy.png")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an unexpected delivery host before making a server-side request", async () => {
    sdk.url.mockReturnValue("https://attacker.example/private-image");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = createCloudinaryStore(config);

    await expect(store.get(storedKey)).rejects.toThrow(/unexpected delivery URL/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the exact authenticated image and treats not-found as success", async () => {
    sdk.destroy.mockResolvedValue({ result: "not found" });
    const store = createCloudinaryStore(config);

    await expect(store.delete(storedKey)).resolves.toBeUndefined();
    expect(sdk.destroy).toHaveBeenCalledWith(publicId, {
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
      timeout: 30_000,
    });
  });

  it("does not retry a permanent delete error", async () => {
    sdk.destroy.mockRejectedValue({
      name: "BadRequest",
      message: "invalid request",
      http_code: 400,
    });
    const store = createCloudinaryStore(config);

    await expect(store.delete(storedKey)).rejects.toMatchObject({ http_code: 400 });
    expect(sdk.destroy).toHaveBeenCalledTimes(1);
  });

  it("uses the Cloudinary-returned versioned key during ingestion", async () => {
    process.env.UPLOAD_STORAGE = "cloudinary";
    process.env.CLOUDINARY_CLOUD_NAME = config.cloudName;
    process.env.CLOUDINARY_API_KEY = config.apiKey;
    process.env.CLOUDINARY_API_SECRET = config.apiSecret;

    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.writeUInt32BE(13, 8);
    png.write("IHDR", 12, "latin1");
    png.writeUInt32BE(2, 16);
    png.writeUInt32BE(3, 20);

    let ingestedPublicId = "";
    sdk.uploadStream.mockImplementation(
      (options: UploadApiOptions, callback: UploadResponseCallback) =>
        new Writable({
          write(_chunk, _encoding, done) {
            done();
          },
          final(done) {
            ingestedPublicId = String(options.public_id);
            callback(undefined, response({
              public_id: ingestedPublicId,
              bytes: png.byteLength,
            }));
            done();
          },
        }),
    );
    const [upload] = await ingestUploads(
      [new File([new Uint8Array(png)], "shot.png", { type: "image/png" })],
      "actor-1",
    );

    expect(upload.key).toBe(`v1719307544/${ingestedPublicId}.png`);
    expect(ingestedPublicId).toMatch(/^attachments\/\d{4}\/\d{2}\/[a-f0-9-]{36}$/);
  });
});

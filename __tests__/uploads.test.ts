// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { detectImage, isOversizedImage, MAX_IMAGE_DIMENSION } = await import("@/lib/uploads/sniff");
const { buildUploadObjectKey, sanitizeOriginalName, ORIGINAL_NAME_MAX_LENGTH } = await import(
  "@/lib/uploads/keys"
);
const {
  formatBytes,
  uploadLimit,
  uploadMaxBytes,
  UPLOAD_LIMIT_DEFAULT,
  UPLOAD_MAX_BYTES_CEILING,
  UPLOAD_MAX_BYTES_DEFAULT,
} = await import("@/lib/uploads/limits");
const { formFiles, ingestUploads, UploadValidationError } = await import("@/lib/uploads/ingest");
const { getUploadStore, uploadStorageMode } = await import("@/lib/uploads/store");

const UPLOAD_ENV = ["UPLOAD_STORAGE", "MAX_UPLOADS_PER_ITEM", "MAX_UPLOAD_BYTES"] as const;
const originalEnv = Object.fromEntries(UPLOAD_ENV.map((key) => [key, process.env[key]]));

/** The process-local bucket behind `UPLOAD_STORAGE=memory`; cleared between tests. */
const memoryBucket = (globalThis as { __slUploadMemory?: Map<string, unknown> })
  .__slUploadMemory;

beforeEach(() => {
  for (const key of UPLOAD_ENV) delete process.env[key];
  memoryBucket?.clear();
});

afterEach(() => {
  for (const key of UPLOAD_ENV) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** Minimal but structurally valid PNG header carrying the given dimensions. */
function pngBytes(width = 2, height = 3) {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "latin1");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/** SOI + APP0 + SOF0, which is what the JPEG header parser walks. */
function jpegBytes(width = 40, height = 30) {
  const buffer = Buffer.alloc(32);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xe0;
  buffer.writeUInt16BE(16, 4);
  buffer[20] = 0xff;
  buffer[21] = 0xc0;
  buffer.writeUInt16BE(17, 22);
  buffer[24] = 8;
  buffer.writeUInt16BE(height, 25);
  buffer.writeUInt16BE(width, 27);
  return buffer;
}

function gifBytes(width = 7, height = 9) {
  const buffer = Buffer.alloc(10);
  buffer.write("GIF89a", 0, "latin1");
  buffer.writeUInt16LE(width, 6);
  buffer.writeUInt16LE(height, 8);
  return buffer;
}

function webpVp8xBytes(width = 100, height = 50) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "latin1");
  buffer.write("WEBP", 8, "latin1");
  buffer.write("VP8X", 12, "latin1");
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function webpVp8Bytes(width = 320, height = 240) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "latin1");
  buffer.write("WEBP", 8, "latin1");
  buffer.write("VP8 ", 12, "latin1");
  buffer[23] = 0x9d;
  buffer[24] = 0x01;
  buffer[25] = 0x2a;
  buffer.writeUInt16LE(width, 26);
  buffer.writeUInt16LE(height, 28);
  return buffer;
}

function webpVp8lBytes(width = 12, height = 34) {
  const buffer = Buffer.alloc(25);
  buffer.write("RIFF", 0, "latin1");
  buffer.write("WEBP", 8, "latin1");
  buffer.write("VP8L", 12, "latin1");
  buffer[20] = 0x2f;
  // 14 bits of width-1 followed by 14 bits of height-1.
  buffer.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return buffer;
}

const imageFile = (bytes: Uint8Array, name = "shot.png", type = "image/png") =>
  new File([new Uint8Array(bytes)], name, { type });

describe("image sniffing", () => {
  it("identifies each supported format from its magic bytes and reads the dimensions", () => {
    expect(detectImage(pngBytes(2, 3))).toMatchObject({
      mimeType: "image/png",
      extension: "png",
      width: 2,
      height: 3,
    });
    expect(detectImage(jpegBytes(40, 30))).toMatchObject({
      mimeType: "image/jpeg",
      extension: "jpg",
      width: 40,
      height: 30,
    });
    expect(detectImage(gifBytes(7, 9))).toMatchObject({
      mimeType: "image/gif",
      extension: "gif",
      width: 7,
      height: 9,
    });
    expect(detectImage(webpVp8xBytes(100, 50))).toMatchObject({
      mimeType: "image/webp",
      extension: "webp",
      width: 100,
      height: 50,
    });
    expect(detectImage(webpVp8Bytes(320, 240))).toMatchObject({ width: 320, height: 240 });
    expect(detectImage(webpVp8lBytes(12, 34))).toMatchObject({ width: 12, height: 34 });
  });

  it("rejects anything that is not a supported image", () => {
    expect(detectImage(Buffer.from("%PDF-1.7\n"))).toBeNull();
    expect(detectImage(Buffer.from("PK\u0003\u0004zip"))).toBeNull();
    expect(detectImage(Buffer.from("just text"))).toBeNull();
    expect(detectImage(Buffer.alloc(0))).toBeNull();
    // A truncated header must not be mistaken for a valid image.
    expect(detectImage(pngBytes().subarray(0, 12))).toBeNull();
  });

  it("flags dimensions that would explode into too many pixels", () => {
    expect(isOversizedImage({ width: 100, height: 100 })).toBe(false);
    expect(isOversizedImage({ width: MAX_IMAGE_DIMENSION + 1, height: 10 })).toBe(true);
    expect(isOversizedImage({ width: 100_000, height: 100_000 })).toBe(true);
    expect(isOversizedImage({ width: 0, height: 10 })).toBe(true);
    // Unknown dimensions are not treated as oversized.
    expect(isOversizedImage({ width: null, height: null })).toBe(false);
  });

  it("detects a decompression bomb declared only in the JPEG header", () => {
    const bomb = detectImage(jpegBytes(60_000, 60_000));
    expect(bomb).not.toBeNull();
    expect(isOversizedImage(bomb!)).toBe(true);
  });
});

describe("object keys and display names", () => {
  it("generates a date-partitioned, collision-free key that ignores the client filename", () => {
    const key = buildUploadObjectKey("png", new Date("2026-03-04T12:00:00Z"));
    expect(key).toMatch(/^attachments\/2026\/03\/[0-9a-f-]{36}\.png$/);
    expect(buildUploadObjectKey("png")).not.toBe(buildUploadObjectKey("png"));
  });

  it("falls back to a neutral extension when handed something unexpected", () => {
    expect(buildUploadObjectKey("../../evil")).toMatch(/\.bin$/);
    expect(buildUploadObjectKey("")).toMatch(/\.bin$/);
  });

  it("strips directory components, control characters and leading dots", () => {
    expect(sanitizeOriginalName("C:\\Users\\me\\shot.png")).toBe("shot.png");
    expect(sanitizeOriginalName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalName("..hidden.png")).toBe("hidden.png");
    expect(sanitizeOriginalName("bad\u0000name\u001f.png")).toBe("badname.png");
    expect(sanitizeOriginalName("  spaced.png  ")).toBe("spaced.png");
    expect(sanitizeOriginalName("")).toBe("image");
    expect(sanitizeOriginalName("   ")).toBe("image");
  });

  it("clamps a very long display name", () => {
    expect(sanitizeOriginalName(`${"a".repeat(5000)}.png`)).toHaveLength(ORIGINAL_NAME_MAX_LENGTH);
  });
});

describe("upload limits", () => {
  it("uses strict defaults when nothing is configured", () => {
    expect(uploadLimit()).toBe(UPLOAD_LIMIT_DEFAULT);
    expect(uploadMaxBytes()).toBe(UPLOAD_MAX_BYTES_DEFAULT);
  });

  it("falls back to the default instead of removing the cap", () => {
    process.env.MAX_UPLOADS_PER_ITEM = "not-a-number";
    process.env.MAX_UPLOAD_BYTES = "-1";
    expect(uploadLimit()).toBe(UPLOAD_LIMIT_DEFAULT);
    expect(uploadMaxBytes()).toBe(UPLOAD_MAX_BYTES_DEFAULT);

    process.env.MAX_UPLOADS_PER_ITEM = "9999";
    process.env.MAX_UPLOAD_BYTES = String(UPLOAD_MAX_BYTES_CEILING * 10);
    expect(uploadLimit()).toBe(UPLOAD_LIMIT_DEFAULT);
    expect(uploadMaxBytes()).toBe(UPLOAD_MAX_BYTES_DEFAULT);
  });

  it("honours a sane configured value", () => {
    process.env.MAX_UPLOADS_PER_ITEM = "5";
    process.env.MAX_UPLOAD_BYTES = String(1024 * 1024);
    expect(uploadLimit()).toBe(5);
    expect(uploadMaxBytes()).toBe(1024 * 1024);
  });

  it("formats byte sizes for error messages", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });
});

describe("storage selection", () => {
  it("defaults to the in-memory store outside production and to disabled in production", () => {
    expect(uploadStorageMode()).toBe("memory");

    vi.stubEnv("NODE_ENV", "production");
    expect(uploadStorageMode()).toBe("disabled");
    expect(getUploadStore()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("never selects r2 while credentials are missing", () => {
    process.env.UPLOAD_STORAGE = "r2";
    expect(uploadStorageMode()).toBe("disabled");
    expect(getUploadStore()).toBeNull();
  });

  it("treats an explicit disable as no store at all", () => {
    process.env.UPLOAD_STORAGE = "disabled";
    expect(getUploadStore()).toBeNull();
  });
});

describe("ingesting uploads", () => {
  it("stores a real image and hands the same bytes back", async () => {
    const bytes = pngBytes(4, 6);
    const [upload] = await ingestUploads([imageFile(bytes, "C:\\shots\\evidence.png")], "actor-1");

    expect(upload).toMatchObject({
      originalName: "evidence.png",
      mimeType: "image/png",
      byteSize: bytes.byteLength,
      width: 4,
      height: 6,
      uploadedBy: "actor-1",
    });
    expect(upload.key).toMatch(/^attachments\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);

    const stored = await getUploadStore()!.get(upload.key);
    expect(stored?.contentType).toBe("image/png");
    expect(Buffer.from(stored!.body).equals(bytes)).toBe(true);
  });

  it("returns nothing for an empty selection without touching storage", async () => {
    await expect(ingestUploads([], "actor-1")).resolves.toEqual([]);
  });

  it("ignores the declared MIME type and rejects a non-image", async () => {
    const file = imageFile(Buffer.from("just text"), "not-really.png", "image/png");

    await expect(ingestUploads([file], "actor-1")).rejects.toBeInstanceOf(UploadValidationError);
    await expect(ingestUploads([file], "actor-1")).rejects.toMatchObject({ field: "uploads" });
  });

  it("reports the caller-provided field name so the form can highlight it", async () => {
    await expect(
      ingestUploads([imageFile(Buffer.from("nope"))], "actor-1", "solutionUploads"),
    ).rejects.toMatchObject({ field: "solutionUploads" });
  });

  it("enforces the configured file count", async () => {
    process.env.MAX_UPLOADS_PER_ITEM = "1";
    const files = [imageFile(pngBytes()), imageFile(pngBytes(), "second.png")];

    await expect(ingestUploads(files, "actor-1")).rejects.toThrow(/at most 1 file/i);
  });

  it("enforces the per-file byte cap", async () => {
    process.env.MAX_UPLOAD_BYTES = "1024";
    const oversized = Buffer.concat([pngBytes(), Buffer.alloc(4096)]);

    await expect(ingestUploads([imageFile(oversized)], "actor-1")).rejects.toThrow(/larger than/i);
  });

  it("refuses to accept files when no store is configured", async () => {
    process.env.UPLOAD_STORAGE = "disabled";

    await expect(ingestUploads([imageFile(pngBytes())], "actor-1")).rejects.toThrow(/not enabled/i);
  });

  it("deletes everything already written when a later file in the set is rejected", async () => {
    const good = imageFile(pngBytes());
    const bad = imageFile(Buffer.from("not an image"), "bad.png");

    await expect(ingestUploads([good, bad], "actor-1")).rejects.toBeInstanceOf(
      UploadValidationError,
    );

    expect(memoryBucket?.size ?? 0).toBe(0);
  });

  it("only exposes real files through the form reader", () => {
    const formData = new FormData();
    const file = imageFile(pngBytes());
    formData.append("uploads", file);
    formData.append("uploads", "not-a-file");
    formData.append("uploads", new File([], "empty.png", { type: "image/png" }));
    formData.append("other", file);

    expect(formFiles(formData)).toEqual([file]);
    expect(formFiles(formData, "nothing")).toEqual([]);
  });
});

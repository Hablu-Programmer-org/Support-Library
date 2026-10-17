/**
 * Image identification from raw bytes.
 *
 * The declared `File.type` and the client filename are attacker-controlled, so
 * the accepted type is decided by the file's own magic bytes — the same reason
 * `X-Content-Type-Options: nosniff` is served on every response. Dimensions are
 * parsed from the header as a cheap decompression-bomb guard: rendering a 5 MiB
 * PNG can otherwise expand to gigabytes of pixels.
 */

export type DetectedImage = {
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  extension: "png" | "jpg" | "webp" | "gif";
  width: number | null;
  height: number | null;
};

/** Reject any image wider or taller than this, whatever the file size. */
export const MAX_IMAGE_DIMENSION = 8000;

/**
 * Reject images above this many pixels (25 MP) as a decompression-bomb guard.
 * This also matches Cloudinary Free's image-resolution ceiling, so an image the
 * app accepts is not later rejected by the selected production backend.
 */
export const MAX_IMAGE_PIXELS = 25_000_000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngSize(buffer: Buffer): { width: number; height: number } | null {
  // 8-byte signature + 4-byte chunk length + "IHDR" + width + height
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString("latin1", 12, 16) !== "IHDR") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readGifSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const header = buffer.toString("latin1", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function readJpegSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2; // past SOI
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    let marker = buffer[offset + 1];
    // Fill bytes: a marker code may be preceded by repeated 0xFF bytes.
    let markerAt = offset + 1;
    while (marker === 0xff && markerAt + 1 < buffer.length) {
      markerAt += 1;
      marker = buffer[markerAt];
    }
    if (marker === 0xff) return null;

    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset = markerAt + 1;
      continue;
    }
    // End of image, or the entropy-coded scan started without a frame header.
    if (marker === 0xd9 || marker === 0xda) return null;

    const lengthAt = markerAt + 1;
    if (lengthAt + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(lengthAt);
    if (segmentLength < 2) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (lengthAt + 7 > buffer.length) return null;
      return {
        height: buffer.readUInt16BE(lengthAt + 3),
        width: buffer.readUInt16BE(lengthAt + 5),
      };
    }

    offset = lengthAt + segmentLength;
  }

  return null;
}

function readWebpSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 16) return null;
  if (buffer.toString("latin1", 0, 4) !== "RIFF") return null;
  if (buffer.toString("latin1", 8, 12) !== "WEBP") return null;

  const chunk = buffer.toString("latin1", 12, 16);

  // Extended format: 24-bit little-endian canvas size, minus one.
  if (chunk === "VP8X") {
    if (buffer.length < 30) return null;
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  // Lossy: `9D 01 2A` start code, then 16-bit dimensions (top 2 bits unused).
  if (chunk === "VP8 ") {
    if (buffer.length < 30) return null;
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null;
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  // Lossless: signature byte, then 14-bit width-1 and height-1 packed together.
  if (chunk === "VP8L") {
    if (buffer.length < 25) return null;
    if (buffer[20] !== 0x2f) return null;
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

/** Returns the detected image type, or `null` when the bytes are not a supported image. */
export function detectImage(buffer: Buffer): DetectedImage | null {
  const png = readPngSize(buffer);
  if (png) return { mimeType: "image/png", extension: "png", ...png };

  const jpeg = readJpegSize(buffer);
  if (jpeg) return { mimeType: "image/jpeg", extension: "jpg", ...jpeg };

  const gif = readGifSize(buffer);
  if (gif) return { mimeType: "image/gif", extension: "gif", ...gif };

  const webp = readWebpSize(buffer);
  if (webp) return { mimeType: "image/webp", extension: "webp", ...webp };

  return null;
}

/** True when the parsed dimensions are too large to serve safely. */
export function isOversizedImage(image: Pick<DetectedImage, "width" | "height">): boolean {
  const { width, height } = image;
  if (width === null || height === null) return false;
  if (width <= 0 || height <= 0) return true;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) return true;
  return width * height > MAX_IMAGE_PIXELS;
}

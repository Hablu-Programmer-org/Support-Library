import { Buffer } from "node:buffer";

/**
 * A real, decodable 1×1 PNG.
 *
 * The upload pipeline sniffs magic bytes and `IHDR`, but the storage backend
 * validates the whole file: Cloudinary answers `400 Invalid image file` for a
 * header-only stub, which the action reports as the generic "Unable to attach
 * the selected files" alert. Tests must therefore submit bytes that a real
 * store accepts, not just bytes that pass the sniffer.
 */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

/** The same image as a Playwright `setInputFiles` payload. */
export function tinyPngFile(name: string) {
  return { name, mimeType: "image/png", buffer: Buffer.from(TINY_PNG) };
}

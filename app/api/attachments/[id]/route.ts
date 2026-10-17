import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { canMutate } from "@/lib/roles";
import { findAttachmentForDownload } from "@/lib/services/attachments";
import { consumeRateLimit, MutationRateLimitError } from "@/lib/services/rate-limit";
import { getUploadStore } from "@/lib/uploads/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authorized, same-origin download of one uploaded image.
 *
 * Nothing is served directly from the object store: the bucket stays private and
 * every read passes through here, so the storage key never reaches the client and
 * access can be revoked by changing the document.
 *
 * Authorization:
 * - any ACTIVE staff member (ADMIN/MENTOR) may read any attachment, and
 * - the uploader may read their own upload, so a student can retrieve the
 *   screenshot they submitted even though uploads are never published.
 *
 * Everything else is answered with 404 (never 403) so the endpoint cannot be
 * used to probe whether an arbitrary attachment id exists.
 */

const UNAUTHORIZED = () =>
  new NextResponse("Unauthorized", {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });

const NOT_FOUND = () =>
  new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });

/**
 * Builds a `Content-Disposition` value that survives non-ASCII filenames: an
 * ASCII-only fallback plus the RFC 5987 encoded form. Quotes, backslashes and
 * control characters are stripped so the filename cannot break out of the value.
 */
function contentDisposition(name: string): string {
  const fallback = name
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 200);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user || session.user.isActive === false) return UNAUTHORIZED();

  const attachment = await findAttachmentForDownload(id);
  if (!attachment) return NOT_FOUND();

  const isStaff = Boolean(session.user.role && canMutate(session.user.role));
  const isUploader = attachment.uploadedBy === session.user.id;
  if (!isStaff && !isUploader) return NOT_FOUND();

  try {
    await consumeRateLimit("attachment.download", session.user.id);
  } catch (error) {
    if (error instanceof MutationRateLimitError) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
    return new NextResponse("Service unavailable", {
      status: 503,
      headers: { "Retry-After": "5" },
    });
  }

  const store = getUploadStore();
  if (!store) return NOT_FOUND();

  let object: Awaited<ReturnType<typeof store.get>>;
  try {
    object = await store.get(attachment.key);
  } catch {
    return new NextResponse("Service unavailable", {
      status: 503,
      headers: { "Retry-After": "5" },
    });
  }
  if (!object) return NOT_FOUND();
  if (object.body.byteLength !== attachment.byteSize) {
    return new NextResponse("Service unavailable", {
      status: 503,
      headers: { "Retry-After": "5", "Cache-Control": "no-store" },
    });
  }

  const body = new Uint8Array(object.body);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": contentDisposition(attachment.originalName),
      // Private: the response is per-session, so no shared cache may store it.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

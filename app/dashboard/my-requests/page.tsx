import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Old address of the student's own list, now `/dashboard/my-issues`.
 *
 * Kept so a bookmark, an old email link or a stale `returnTo` still resolves
 * instead of 404-ing.
 */
export default function MyRequestsRedirectPage() {
  redirect("/dashboard/my-issues");
}

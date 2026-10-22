import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy confirmation route.
 *
 * Submission now lands the student on their own request page, where the status,
 * the team's replies and the live support panel live. This route is kept so an
 * old link or bookmark still resolves instead of 404-ing.
 */
export default function IssueSubmittedPage() {
  redirect("/dashboard/my-requests");
}

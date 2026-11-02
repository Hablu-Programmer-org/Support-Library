import { redirect } from "next/navigation";

export default function LegacyN8nRequestsPage() {
  redirect("/dashboard/access-requests");
}

import { NotFoundContent } from "@/components/shared/not-found-content";

/**
 * Segment-level 404. Because it lives in app/dashboard/ it renders
 * inside the dashboard layout, so the header and navigation stay
 * visible instead of dropping the user onto a bare page.
 */
export default function DashboardNotFound() {
  return <NotFoundContent />;
}
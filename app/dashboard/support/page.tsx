import { LiveSupportCard } from "@/components/live-support/live-support-card";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { getLiveSupportConfig } from "@/lib/live-support";

export const dynamic = "force-dynamic";

/**
 * Daily live support join page.
 *
 * The meeting details are resolved on the server and only ever reach a
 * signed-in browser, so the join URL, meeting ID and passcode are not in the
 * public bundle. Availability is the schedule itself — the Join button is
 * disabled outside a support slot.
 */
export default async function LiveSupportPage() {
  await requireSession();
  const config = getLiveSupportConfig();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 py-8">
      <PageHeader
        title="Live support"
        description="Join the support room and share your screen with the team."
      />
      <LiveSupportCard config={config} />
    </div>
  );
}

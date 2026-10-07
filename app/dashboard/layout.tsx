import { DashboardShell } from "@/components/layout/shell";
import { requireSession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const { user } = session;

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
    >
      {children}
    </DashboardShell>
  );
}

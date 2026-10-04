import { requireSession } from "@/lib/auth-guard";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserMenu } from "@/components/auth/user-menu";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const { user } = session;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-xl font-bold text-primary-600 dark:text-primary-400">
                Hablu Support Library
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-primary-600">
                  ড্যাশবোর্ড
                </Link>
                <Link href="/dashboard/students" className="text-gray-600 dark:text-gray-300 hover:text-primary-600">
                  স্টুডেন্ট
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    href="/dashboard/admin"
                    className="text-gray-600 dark:text-gray-300 hover:text-primary-600"
                  >
                    অ্যাডমিন
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <UserMenu user={user} />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

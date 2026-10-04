import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";

import { updateStaffActiveAction, updateStaffRoleAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { listStaff } from "@/lib/services/staff";
import { USER_ROLES } from "@/models";

export const dynamic = "force-dynamic";

export default async function StaffAdminPage() {
  await requireAdmin();
  const staff = await listStaff();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Google login-এর পরে staff default VIEWER হয়. এখান থেকে MENTOR/ADMIN role দিন বা inactive করুন।
        </p>
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="font-semibold">Staff Users</CardHeader>
        <CardBody className="p-0">
          {staff.length === 0 ? (
            <div className="p-8 text-sm text-gray-500 dark:text-gray-400">কোনো staff user পাওয়া যায়নি।</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {staff.map((user) => (
                <div key={user.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_220px_220px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{user.name}</h2>
                      <Chip size="sm" variant="flat" color={user.isActive ? "success" : "danger"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Chip>
                      <Chip size="sm" variant="flat">{user.role}</Chip>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("bn-BD") : "Never"}
                    </p>
                  </div>

                  <form action={updateStaffRoleAction.bind(null, user.id)} className="flex gap-2">
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
                    >
                      {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <Button type="submit" color="primary" variant="flat">Save</Button>
                  </form>

                  <form action={updateStaffActiveAction.bind(null, user.id)} className="flex gap-2">
                    <select
                      name="isActive"
                      defaultValue={String(user.isActive)}
                      className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                    <Button type="submit" color="warning" variant="flat">Update</Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

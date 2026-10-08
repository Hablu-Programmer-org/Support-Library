import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";

import { updateStaffActiveAction, updateStaffRoleAction } from "@/actions/admin";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/lib/auth-guard";
import { nativeSelectClass } from "@/lib/config/fields";
import { listStaff } from "@/lib/services/staff";
import { USER_ROLES } from "@/models";

export const dynamic = "force-dynamic";

export default async function StaffAdminPage() {
  await requireAdmin();
  const staff = await listStaff();

  return (
    <div className="space-y-6">
      <PageHeader
        description="Google login-এর পরে staff default VIEWER হয়. এখান থেকে MENTOR/ADMIN role দিন বা inactive করুন।"
        title="Staff Management"
      />

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardHeader className="font-semibold">Staff Users</CardHeader>
        <CardBody className="p-0">
          {staff.length === 0 ? (
            <div className="p-8 text-sm text-slate-500 dark:text-slate-400">কোনো staff user পাওয়া যায়নি।</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("bn-BD") : "Never"}
                    </p>
                  </div>

                  <form action={updateStaffRoleAction.bind(null, user.id)} className="flex gap-2">
                    <select
                      name="role"
                      defaultValue={user.role}
                      className={`${nativeSelectClass} min-w-0 flex-1`}
                    >
                      {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <Button type="submit" color="primary" variant="flat">Save</Button>
                  </form>

                  <form action={updateStaffActiveAction.bind(null, user.id)} className="flex gap-2">
                    <select
                      name="isActive"
                      defaultValue={String(user.isActive)}
                      className={`${nativeSelectClass} min-w-0 flex-1`}
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

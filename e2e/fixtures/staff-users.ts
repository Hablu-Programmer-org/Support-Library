import type { UserRole } from "../../models/User";

export type StaffFixtureUser = {
  /** Fixed ObjectId so JWT `id`/`sub` always matches a real `staff_users` row. */
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

/**
 * Staff identities that Playwright signs in as.
 *
 * Shared with `scripts/clean-e2e-artifacts.ts` so cleanup patterns cannot drift
 * from what the fixtures actually write.
 */
export const STAFF_USERS: readonly StaffFixtureUser[] = [
  {
    id: "0000000000000000000000a1",
    name: "admin",
    email: "owner@hablu-programmer.com",
    role: "ADMIN",
    isActive: true,
  },
  {
    id: "0000000000000000000000b2",
    name: "mentor",
    email: "mentor@hablu-programmer.com",
    role: "MENTOR",
    isActive: true,
  },
  {
    id: "0000000000000000000000c3",
    name: "viewer",
    email: "viewer@hablu-programmer.com",
    role: "VIEWER",
    isActive: true,
  },
];

export const STAFF_FIXTURE_IDS = STAFF_USERS.map((user) => new RegExp(`^${user.id}$`));
export const STAFF_FIXTURE_EMAILS = STAFF_USERS.map((user) => user.email);

export const staffDisplayName = (name: string) =>
  `${name.charAt(0).toUpperCase()}${name.slice(1)} User`;
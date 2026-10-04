"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, User } from "@heroui/react";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <User
          name={user.name ?? "বেনামী"}
          avatarProps={{ src: user.image ?? undefined }}
          className="cursor-pointer"
        />
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem key="info" isDisabled>
          <div className="flex flex-col gap-1">
            <span className="font-medium">{user.name ?? "বেনামী"}</span>
            <span className="text-xs text-gray-500">{user.email}</span>
            <span
              className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full inline-block w-fit mt-1"
            >
              {user.role}
            </span>
          </div>
        </DropdownItem>
        <DropdownItem key="divider" showDivider isDisabled>
          <></>
        </DropdownItem>
        <DropdownItem key="profile">প্রোফাইল</DropdownItem>
        <DropdownItem key="settings">সেটিংস</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
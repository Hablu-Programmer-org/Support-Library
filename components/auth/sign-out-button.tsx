"use client";

import { signOut } from "next-auth/react";
import { Button } from "@heroui/react";

export function SignOutButton() {
  return (
    <Button
      onClick={() => signOut({ callbackUrl: "/login" })}
      color="danger"
      variant="flat"
      size="sm"
    >
      Sign Out
    </Button>
  );
}

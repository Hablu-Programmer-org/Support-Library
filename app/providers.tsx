"use client";

import { HeroUIProvider } from "@heroui/system";
import { SessionProvider } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { FC, ReactNode } from "react";

type Props = { children: ReactNode };

export const Providers: FC<Props> = ({ children }) => {
  const router = useRouter();

  return (
    <SessionProvider>
      <HeroUIProvider navigate={router.push}>{children}</HeroUIProvider>
    </SessionProvider>
  );
};
"use client";

import { HeroUIProvider } from "@heroui/system";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";
import type { FC, ReactNode } from "react";

type Props = { children: ReactNode };

export const Providers: FC<Props> = ({ children }) => {
  const router = useRouter();

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <>{children}</>
      </ThemeProvider>
    </SessionProvider>
  );
};
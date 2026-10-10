"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { FC, ReactNode } from "react";

type Props = { children: ReactNode };

export const Providers: FC<Props> = ({ children }) => {
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

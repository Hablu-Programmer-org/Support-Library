"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { FC, ReactNode } from "react";

type Props = { children: ReactNode; nonce?: string };

export const Providers: FC<Props> = ({ children, nonce }) => {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        <>{children}</>
      </ThemeProvider>
    </SessionProvider>
  );
};

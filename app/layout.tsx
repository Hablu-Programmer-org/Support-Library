import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";
import { Providers } from "./providers";

// next/font downloads and self-hosts the file, so there is no runtime request to
// Google and no layout shift. Weights cover the font-normal/medium/semibold/bold
// utilities used across the app.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hablu Support Library",
  description: "Staff support knowledge system for Hablu Programmer",
  other: {
    "darkreader-lock": "true",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning is required: next-themes sets the `dark` class on
    // <html> before React hydrates, so the server and client markup differ.
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}

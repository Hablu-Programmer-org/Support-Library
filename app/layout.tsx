import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";

import "./globals.css";
import { Providers } from "./providers";

// Self-hosted variable font (committed under app/fonts). next/font/local inlines
// the file at build time with no network dependency, so production and Docker
// builds are hermetic. The weight axis covers the font-normal/medium/semibold/
// bold utilities used across the app.
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
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
    <html lang="en" suppressHydrationWarning className={geistSans.variable}>
      <body>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}

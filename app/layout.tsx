import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Hablu Support Library",
  description: "Staff support knowledge system for Hablu Programmer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
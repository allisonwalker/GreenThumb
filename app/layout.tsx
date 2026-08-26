import type { Metadata } from "next";

import { AuthenticatedShell } from "@/components/authenticated-shell";

import "./globals.css";

export const metadata: Metadata = {
  title: "Jory Journal",
  description: "Garden care for one household",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </body>
    </html>
  );
}

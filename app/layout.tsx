import type { Metadata } from "next";

import { AppNav } from "@/components/app-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "GreenThumb",
  description: "Garden care for one household",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-dvh max-w-5xl md:grid md:grid-cols-[auto_1fr]">
          <AppNav />
          <main className="px-4 py-8 pb-24 sm:px-6 md:px-10 md:pb-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

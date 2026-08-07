"use client";

import { usePathname } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignIn = pathname.startsWith("/sign-in");

  return (
    <div
      className={cn(
        "mx-auto min-h-dvh max-w-5xl",
        !isSignIn && "md:grid md:grid-cols-[auto_1fr]",
      )}
    >
      {!isSignIn ? <AppNav /> : null}
      <main
        className={cn(
          "px-4 py-8 sm:px-6 md:px-10",
          !isSignIn && "pb-24 md:pb-8",
        )}
      >
        {children}
      </main>
    </div>
  );
}

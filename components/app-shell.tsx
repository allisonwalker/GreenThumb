"use client";

import { usePathname } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { PRODUCT_LABEL } from "@/lib/shell/identity";

function ShellIdentity({ gardenName }: { gardenName: string }) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-tight text-neutral-950">
        {PRODUCT_LABEL}
      </p>
      <p className="text-xs text-neutral-600">{gardenName}</p>
    </div>
  );
}

export function AppShell({
  children,
  gardenName,
}: {
  children: React.ReactNode;
  gardenName: string;
}) {
  const pathname = usePathname();
  const isMarketing = pathname === "/" || pathname.startsWith("/sign-in");

  if (isMarketing) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-5xl md:grid md:grid-cols-[auto_1fr]">
      <div className="md:flex md:flex-col md:border-r">
        <div className="hidden border-b px-4 py-4 md:block">
          <ShellIdentity gardenName={gardenName} />
        </div>
        <AppNav />
      </div>
      <div>
        <header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 md:hidden">
          <ShellIdentity gardenName={gardenName} />
        </header>
        <main className="px-4 py-8 pb-24 sm:px-6 md:px-10 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}

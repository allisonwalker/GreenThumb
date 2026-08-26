"use client";

import { usePathname } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { isMarketingPath, PRODUCT_LABEL } from "@/lib/shell/identity";

function ShellIdentity({ gardenName }: { gardenName: string }) {
  return (
    <div>
      <p className="text-sm font-bold tracking-display text-cream">
        {PRODUCT_LABEL}
      </p>
      <p className="text-xs text-leaf">{gardenName}</p>
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

  if (isMarketingPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-5xl md:grid md:grid-cols-[auto_1fr]">
      <div className="bg-forest text-cream md:flex md:flex-col md:border-r">
        <div className="hidden border-b px-4 py-4 md:block">
          <ShellIdentity gardenName={gardenName} />
        </div>
        <AppNav />
      </div>
      <div>
        <header className="sticky top-0 z-10 border-b bg-forest px-4 py-3 text-cream sm:px-6 md:hidden">
          <ShellIdentity gardenName={gardenName} />
        </header>
        <main className="px-4 py-8 pb-24 sm:px-6 md:px-10 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}

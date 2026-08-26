"use client";

import {
  CircleHelp,
  ClipboardPlus,
  Flower2,
  Leaf,
  ListTodo,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/lib/auth/actions";
import { PRIMARY_NAV_HREFS } from "@/lib/shell/identity";
import { cn } from "@/lib/utils";

const destinationMeta = {
  "/today": { label: "Today", icon: ListTodo },
  "/garden": { label: "Garden", icon: Flower2 },
  "/catalog": { label: "Catalog", icon: Leaf },
  "/log": { label: "Log", icon: ClipboardPlus },
  "/ask": { label: "Ask", icon: CircleHelp },
} as const;

export function AppNav() {
  const pathname = usePathname();

  if (pathname === "/" || pathname.startsWith("/sign-in")) {
    return null;
  }

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-white md:static md:border-t-0"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6 md:w-52 md:grid-cols-1 md:gap-2 md:p-4">
        {PRIMARY_NAV_HREFS.map((href) => {
          const { label, icon: Icon } = destinationMeta[href];
          const isActive = pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors md:min-h-11 md:flex-row md:justify-start md:rounded-lg md:px-3 md:text-sm",
                  isActive
                    ? "bg-green-50 text-green-800"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-16 w-full flex-col items-center justify-center gap-1 px-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 md:min-h-11 md:flex-row md:justify-start md:rounded-lg md:px-3 md:text-sm"
            >
              <LogOut aria-hidden="true" className="size-5" />
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}

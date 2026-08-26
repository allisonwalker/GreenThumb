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
import { isMarketingPath, PRIMARY_NAV_HREFS } from "@/lib/shell/identity";
import { cn } from "@/lib/utils";

const destinationMeta = {
  "/today": { label: "Today", icon: ListTodo },
  "/garden": { label: "Garden", icon: Flower2 },
  "/catalog": { label: "Catalog", icon: Leaf },
  "/log": { label: "Log", icon: ClipboardPlus },
  "/ask": { label: "Ask", icon: CircleHelp },
} as const;

const navItemClass =
  "flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors md:min-h-11 md:flex-row md:justify-start md:rounded-lg md:px-3 md:text-sm";

export function AppNav() {
  const pathname = usePathname();

  if (isMarketingPath(pathname)) {
    return null;
  }

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-forest md:static md:border-t-0 md:bg-transparent"
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
                  navItemClass,
                  isActive
                    ? "bg-selection text-cream"
                    : "text-leaf hover:bg-selection hover:text-cream",
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
              className={cn(
                navItemClass,
                "w-full text-leaf hover:bg-selection hover:text-cream",
              )}
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

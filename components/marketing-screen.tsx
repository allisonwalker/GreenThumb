import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MarketingScreenProps = {
  children: ReactNode;
  className?: string;
};

export function MarketingScreen({ children, className }: MarketingScreenProps) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-[#172217] text-[#f7faf7] selection:bg-[#3d6b3d] selection:text-[#f7faf7]",
        className,
      )}
    >
      {children}
    </div>
  );
}

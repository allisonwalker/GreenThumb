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
        "flex min-h-dvh flex-col bg-forest text-cream selection:bg-selection selection:text-cream",
        className,
      )}
    >
      {children}
    </div>
  );
}

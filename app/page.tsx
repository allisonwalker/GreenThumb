import Link from "next/link";
import { redirect } from "next/navigation";

import { MarketingScreen } from "@/components/marketing-screen";
import { getAuthenticatedIdentity } from "@/lib/auth/session";

export default async function Home() {
  const identity = await getAuthenticatedIdentity();

  if (identity) {
    redirect("/today");
  }

  return (
    <MarketingScreen className="justify-between gap-16 px-5 py-8 sm:px-10 sm:py-12">
      <div className="max-w-5xl">
        <h1 className="max-w-[12ch] text-display font-bold tracking-display">
          Jory Journal
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-7 text-leaf sm:text-xl sm:leading-8">
          Remembers this one bed and its pots. Today&apos;s care list comes from
          stored crop needs, weather, and the log.
        </p>
      </div>
      <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <ul className="max-w-md space-y-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          <li>One bed. Eight pots.</li>
          <li>Two of you. Same list.</li>
          <li>Hours in, work that matters.</li>
        </ul>
        <Link
          href="/sign-in"
          className="inline-flex min-h-14 items-center justify-center rounded-lg bg-cream px-8 text-base font-semibold text-forest transition-colors hover:bg-white"
        >
          Sign in with email
        </Link>
      </div>
    </MarketingScreen>
  );
}

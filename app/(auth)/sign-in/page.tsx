import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";
import { MarketingScreen } from "@/components/marketing-screen";
import { getAuthenticatedIdentity } from "@/lib/auth/session";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const identity = await getAuthenticatedIdentity();
  const { error } = await searchParams;

  if (identity) {
    redirect("/today");
  }

  return (
    <MarketingScreen className="lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex flex-col justify-between px-5 py-8 sm:px-10 sm:py-12">
        <Link
          href="/"
          className="text-sm font-semibold tracking-wide text-[#c5d9c5] underline-offset-4 hover:underline"
        >
          Jory Journal
        </Link>
        <div>
          <h1 className="max-w-[11ch] text-[clamp(3rem,10vw,6.5rem)] font-bold leading-[0.88] tracking-[-0.04em]">
            Sign in to your garden
          </h1>
          <p className="mt-6 max-w-md text-lg leading-7 text-[#d7e5d7]">
            We&apos;ll email you a one-time code. Jory Journal does not use
            passwords.
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center bg-[#f7faf7] px-5 py-10 text-[#172217] sm:px-10">
        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error === "not-allowed"
              ? "That email is not authorized to use Jory Journal."
              : "That sign-in link is invalid or expired. Request a new code on this page and enter the code from the email."}
          </p>
        ) : null}
        <SignInForm />
      </div>
    </MarketingScreen>
  );
}

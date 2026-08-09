import { Sprout } from "lucide-react";
import { redirect } from "next/navigation";

import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";
import { getAuthenticatedIdentity } from "@/lib/auth/session";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const identity = await getAuthenticatedIdentity();
  const { error } = await searchParams;

  if (identity) {
    redirect("/today");
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  return (
    <section className="mx-auto flex min-h-[75dvh] max-w-md items-center">
      <div className="w-full rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <Sprout aria-hidden="true" className="size-10 text-green-700" />
        <p className="mt-5 text-sm font-semibold text-green-700">GreenThumb</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Sign in to your garden
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          We&apos;ll email you a one-time code. GreenThumb does not use
          passwords.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error === "not-allowed"
              ? "That email is not authorized to use GreenThumb."
              : "That sign-in link is invalid or expired. Request a new code on this page and enter the code from the email."}
          </p>
        ) : null}
        <SignInForm
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
        />
      </div>
    </section>
  );
}

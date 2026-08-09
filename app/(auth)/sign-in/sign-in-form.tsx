"use client";

import { useState, type FormEvent } from "react";

import { prepareMagicLink } from "@/app/(auth)/sign-in/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignInFormProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type SignInState = {
  status: "idle" | "error" | "sent";
  message?: string;
};

export function SignInForm({
  supabaseUrl,
  supabaseAnonKey,
}: SignInFormProps) {
  const [state, setState] = useState<SignInState>({ status: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({ status: "idle" });

    try {
      const formData = new FormData(event.currentTarget);
      const prepared = await prepareMagicLink(formData);

      if (!prepared.ok) {
        setState({ status: "error", message: prepared.message });
        return;
      }

      const supabase = createSupabaseBrowserClient(
        supabaseUrl,
        supabaseAnonKey,
      );
      const { error } = await supabase.auth.signInWithOtp({
        email: prepared.email,
        options: {
          emailRedirectTo: prepared.callbackUrl,
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.error("Supabase could not send a magic sign-in link.", error);
        const rateLimited = /rate limit/i.test(error.message);
        setState({
          status: "error",
          message: rateLimited
            ? "Too many sign-in emails were requested. Wait about an hour (Supabase’s free email limit), then try once."
            : "We could not send the sign-in link. Please try again.",
        });
        return;
      }

      setState({
        status: "sent",
        message: `Check ${prepared.email} for your sign-in link.`,
      });
    } catch (error) {
      console.error("Magic-link request failed.", error);
      setState({
        status: "error",
        message: "We could not send the sign-in link. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-neutral-800"
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3 text-base shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-green-800 px-4 font-semibold text-white transition-colors hover:bg-green-900 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-sm text-red-700"
              : "text-sm text-green-800"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

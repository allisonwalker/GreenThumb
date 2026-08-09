"use client";

import { useState, type FormEvent } from "react";

import {
  finishSignIn,
  prepareMagicLink,
} from "@/app/(auth)/sign-in/actions";
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
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [state, setState] = useState<SignInState>({ status: "idle" });
  const [pending, setPending] = useState(false);

  async function onRequestCode(event: FormEvent<HTMLFormElement>) {
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
        console.error("Supabase could not send a sign-in code.", error);
        const rateLimited = /rate limit/i.test(error.message);
        setState({
          status: "error",
          message: rateLimited
            ? "Too many sign-in emails were requested. Wait about an hour (Supabase’s free email limit), then try once."
            : "We could not send the sign-in code. Please try again.",
        });
        return;
      }

      setEmail(prepared.email);
      setOtp("");
      setState({
        status: "sent",
        message: `Check ${prepared.email} for a one-time code (do not use the link — enter the code here).`,
      });
    } catch (error) {
      console.error("Sign-in code request failed.", error);
      setState({
        status: "error",
        message: "We could not send the sign-in code. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  async function onVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState((current) => ({ ...current, status: "sent" }));

    try {
      const token = otp.replace(/\s/g, "");
      if (!/^\d{6,8}$/.test(token)) {
        setState({
          status: "error",
          message: "Enter the 6–8 digit code from the email.",
        });
        return;
      }

      const supabase = createSupabaseBrowserClient(
        supabaseUrl,
        supabaseAnonKey,
      );

      // signInWithOtp emails use the magiclink OTP type; fall back to email.
      let verifyError = (
        await supabase.auth.verifyOtp({
          email,
          token,
          type: "magiclink",
        })
      ).error;

      if (verifyError) {
        verifyError = (
          await supabase.auth.verifyOtp({
            email,
            token,
            type: "email",
          })
        ).error;
      }

      if (verifyError) {
        console.error(
          "Supabase could not verify the sign-in code.",
          verifyError,
        );
        setState({
          status: "error",
          message:
            "That code is invalid or expired. Request a new code and try again.",
        });
        return;
      }

      const finished = await finishSignIn();
      if (!finished.ok) {
        setState({ status: "error", message: finished.message });
        return;
      }

      window.location.assign("/today");
    } catch (error) {
      console.error("Sign-in code verification failed.", error);
      setState({
        status: "error",
        message: "Sign-in failed. Request a new code and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  const showOtpStep = Boolean(email);

  return (
    <div className="mt-8 space-y-5">
      {!showOtpStep ? (
        <form onSubmit={onRequestCode} className="space-y-5">
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
            {pending ? "Sending code…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerifyCode} className="space-y-5">
          <p className="text-sm text-neutral-600">
            Code sent to <span className="font-medium">{email}</span>. Enter
            the code from the email — ignore any sign-in link for now.
          </p>
          <div>
            <label
              htmlFor="otp"
              className="block text-sm font-semibold text-neutral-800"
            >
              Sign-in code
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border bg-white px-3 text-center text-2xl tracking-[0.4em] shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
              placeholder="12345678"
              maxLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="min-h-12 w-full rounded-lg bg-green-800 px-4 font-semibold text-white transition-colors hover:bg-green-900 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="button"
            disabled={pending}
            className="w-full text-sm text-neutral-600 underline-offset-2 hover:underline"
            onClick={() => {
              setEmail("");
              setOtp("");
              setState({ status: "idle" });
            }}
          >
            Use a different email
          </button>
        </form>
      )}

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
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  requestSignInCode,
  verifySignInCode,
} from "@/app/(auth)/sign-in/actions";

type SignInState = {
  status: "idle" | "error" | "sent";
  message?: string;
};

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<SignInState>({ status: "idle" });
  const [pending, setPending] = useState(false);

  async function onRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({ status: "idle" });

    try {
      const result = await requestSignInCode(new FormData(event.currentTarget));

      if (!result.ok) {
        setState({ status: "error", message: result.message });
        return;
      }

      setEmail(result.email);
      setCode("");
      setState({
        status: "sent",
        message: `Check ${result.email} for a one-time code (do not use the link — enter the code here).`,
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
      const result = await verifySignInCode(new FormData(event.currentTarget));

      if (!result.ok) {
        setState({ status: "error", message: result.message });
        return;
      }

      // The action set the session cookie, so this navigation is authenticated.
      router.push("/today");
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

  const showCodeStep = Boolean(email);

  return (
    <div className="mt-8 space-y-5">
      {!showCodeStep ? (
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
          <input type="hidden" name="email" value={email} readOnly />
          <p className="text-sm text-neutral-600">
            Code sent to <span className="font-medium">{email}</span>. Enter the
            code from the email — ignore any sign-in link for now.
          </p>
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-semibold text-neutral-800"
            >
              Sign-in code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
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
              setCode("");
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

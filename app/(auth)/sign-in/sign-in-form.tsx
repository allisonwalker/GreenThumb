"use client";

import { useActionState } from "react";

import {
  requestMagicLink,
  type SignInState,
} from "@/app/(auth)/sign-in/actions";

const initialState: SignInState = { status: "idle" };

export function SignInForm() {
  const [state, action, pending] = useActionState(
    requestMagicLink,
    initialState,
  );

  return (
    <form action={action} className="mt-8 space-y-5">
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

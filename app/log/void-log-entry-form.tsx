"use client";

import { useActionState } from "react";

import { voidGardenAction } from "./actions";
import type { ActionLogFormState } from "@/lib/garden/action-log-validation";

const initialState: ActionLogFormState = { status: "idle" };

export function VoidLogEntryForm({ entryId }: { entryId: string }) {
  const [state, formAction, pending] = useActionState(
    voidGardenAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="actionLogId" value={entryId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 text-sm font-semibold text-red-800 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? "Saving correction…" : "This was a mistake"}
      </button>
      {state.status !== "idle" ? (
        <p
          aria-live="polite"
          className={
            state.status === "error"
              ? "mt-1 text-sm text-red-700"
              : "mt-1 text-sm text-green-800"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

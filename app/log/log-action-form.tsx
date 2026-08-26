"use client";

import { useActionState } from "react";

import { logGardenAction } from "./actions";
import type { LoggableLocation } from "@/lib/garden/action-log-repository";
import type { ActionLogFormState } from "@/lib/garden/action-log-validation";
import {
  ACTION_TYPE_LABELS,
  ACTION_TYPES,
  type ActionType,
} from "@/lib/garden/action-types";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base outline-none focus:border-forest focus:ring-2 focus:ring-leaf";
const initialState: ActionLogFormState = { status: "idle" };

export function LogActionForm({
  locations,
  timeZone,
  nowLocal,
}: {
  locations: LoggableLocation[];
  timeZone: string;
  nowLocal: string;
}) {
  const [state, formAction, pending] = useActionState(
    logGardenAction,
    initialState,
  );

  if (locations.length === 0) {
    return (
      <p className="rounded-2xl border bg-white p-5 text-sm text-forest">
        Add pots or this season’s bed sections before logging care. The log is
        tied to a place in the garden.
      </p>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl border bg-white p-5 sm:p-6">
      <input type="hidden" name="timeZone" value={timeZone} />
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-forest">Log an action</h2>
        <p className="mt-1 text-sm text-forest">
          Saves as soon as you submit. Time is garden-local (
          {timeZone.replace(/_/g, " ")}).
        </p>
      </div>

      <label className="block text-sm font-medium text-forest">
        Where
        <select
          className={fieldClass}
          name="locationId"
          required
          defaultValue={locations[0]?.id}
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
              {location.kind === "pot" ? " (pot)" : ""}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-forest">
          What did you do?
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTION_TYPES.map((actionType: ActionType) => (
            <label
              key={actionType}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-2 text-sm font-semibold text-forest has-[:checked]:border-forest has-[:checked]:bg-cream"
            >
              <input
                className="sr-only"
                type="radio"
                name="actionType"
                value={actionType}
                defaultChecked={actionType === "watered"}
              />
              {ACTION_TYPE_LABELS[actionType]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block text-sm font-medium text-forest">
        When
        <input
          className={fieldClass}
          name="occurredAt"
          type="datetime-local"
          defaultValue={nowLocal}
          required
        />
        <span className="mt-1 block font-normal text-forest">
          Defaults to now. Change this to back-date an earlier watering.
        </span>
      </label>

      <label className="mt-5 block text-sm font-medium text-forest">
        Detail (optional)
        <input
          className={fieldClass}
          name="detail"
          maxLength={2000}
          placeholder="Half can, aphids on the undersides…"
        />
      </label>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          aria-live="polite"
          className={
            state.status === "error"
              ? "text-sm font-medium text-red-700"
              : "text-sm font-medium text-forest"
          }
        >
          {state.status === "idle"
            ? "Partner entries show up here too."
            : state.message}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-lg bg-forest px-6 font-semibold text-cream hover:bg-selection disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Log it"}
        </button>
      </div>
    </form>
  );
}

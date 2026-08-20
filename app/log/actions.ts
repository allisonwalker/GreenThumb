"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUser } from "@/lib/auth/app-user";
import { requirePageUser } from "@/lib/auth/session";
import {
  insertActionLog,
  voidActionLog as persistVoidActionLog,
} from "@/lib/garden/action-log-repository";
import {
  type ActionLogFormState,
  parseActionLogForm,
  parseVoidActionLogForm,
} from "@/lib/garden/action-log-validation";
import { ACTION_TYPE_LABELS } from "@/lib/garden/action-types";

export async function logGardenAction(
  _previousState: ActionLogFormState,
  formData: FormData,
): Promise<ActionLogFormState> {
  const identity = await requirePageUser();

  let input;
  try {
    input = parseActionLogForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  try {
    await ensureAppUser(identity);
    await insertActionLog({ ...input, userId: identity.id });
    revalidatePath("/log");
    return {
      status: "success",
      message: `${ACTION_TYPE_LABELS[input.actionType]} logged.`,
    };
  } catch (error) {
    console.error("Logging a garden action failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error &&
        /current pot or bed section/i.test(error.message)
          ? error.message
          : "The action could not be logged. Please try again.",
    };
  }
}

export async function voidGardenAction(
  _previousState: ActionLogFormState,
  formData: FormData,
): Promise<ActionLogFormState> {
  const identity = await requirePageUser();

  let input;
  try {
    input = parseVoidActionLogForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  try {
    await ensureAppUser(identity);
    await persistVoidActionLog({
      actionLogId: input.actionLogId,
      userId: identity.id,
    });
    revalidatePath("/log");
    return {
      status: "success",
      message: "Correction saved. The original entry is still in the history.",
    };
  } catch (error) {
    console.error("Voiding a garden action failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error &&
        /not found|already been corrected|cannot be voided/i.test(error.message)
          ? error.message
          : "The correction could not be saved. Please try again.",
    };
  }
}

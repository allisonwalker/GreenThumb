"use server";

import { revalidatePath } from "next/cache";

import { requirePageUser } from "@/lib/auth/session";
import {
  dismissRecommendation,
  markRecommendationDone,
} from "@/lib/care/persist";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recommendationIdFromForm(formData: FormData) {
  const value = String(formData.get("recommendationId") ?? "").trim();
  if (!UUID.test(value)) {
    throw new Error("That task could not be found.");
  }
  return value;
}

function isAlreadyClosed(error: unknown) {
  return (
    error instanceof Error && error.message === "That task is no longer open."
  );
}

export async function completeRecommendation(formData: FormData) {
  const user = await requirePageUser();
  try {
    await markRecommendationDone({
      recommendationId: recommendationIdFromForm(formData),
      userId: user.id,
    });
  } catch (error) {
    if (!isAlreadyClosed(error)) {
      throw error;
    }
  }
  revalidatePath("/today");
}

export async function skipRecommendation(formData: FormData) {
  const user = await requirePageUser();
  try {
    await dismissRecommendation({
      recommendationId: recommendationIdFromForm(formData),
      userId: user.id,
    });
  } catch (error) {
    if (!isAlreadyClosed(error)) {
      throw error;
    }
  }
  revalidatePath("/today");
}

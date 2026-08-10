"use server";

import { revalidatePath } from "next/cache";

import { requirePageUser } from "@/lib/auth/session";
import {
  type GardenProfileFormState,
  parseGardenProfileForm,
} from "@/lib/garden/profile-validation";
import { saveGardenProfileRecord } from "@/lib/garden/profile-repository";

export async function saveGardenProfile(
  _previousState: GardenProfileFormState,
  formData: FormData,
): Promise<GardenProfileFormState> {
  await requirePageUser();

  let input;
  try {
    input = parseGardenProfileForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  try {
    await saveGardenProfileRecord(input);
    revalidatePath("/garden");
    return { status: "success", message: "Garden profile saved." };
  } catch (error) {
    console.error("Saving the garden profile failed.", error);
    return {
      status: "error",
      message: "The garden profile could not be saved. Please try again.",
    };
  }
}

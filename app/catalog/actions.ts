"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePageUser } from "@/lib/auth/session";
import {
  resolveOrCreateStubCrop,
  saveCropRecord,
} from "@/lib/crops/repository";
import {
  type CropFormState,
  parseCreateStubCropForm,
  parseCropEditForm,
} from "@/lib/crops/validation";

export async function createStubCrop(
  _previousState: CropFormState,
  formData: FormData,
): Promise<CropFormState> {
  await requirePageUser();

  let input;
  try {
    input = parseCreateStubCropForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  let crop;
  try {
    crop = await resolveOrCreateStubCrop(input.name);
  } catch (error) {
    console.error("Creating a crop stub failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The crop could not be created. Please try again.",
    };
  }

  revalidatePath("/catalog");
  revalidatePath(`/catalog/${crop.id}`);
  redirect(`/catalog/${crop.id}`);
}

export async function saveCrop(
  _previousState: CropFormState,
  formData: FormData,
): Promise<CropFormState> {
  await requirePageUser();

  let input;
  try {
    input = parseCropEditForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  try {
    await saveCropRecord(input);
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${input.id}`);
    return { status: "success", message: "Crop saved. Source is now edited." };
  } catch (error) {
    console.error("Saving a crop failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The crop could not be saved. Please try again.",
    };
  }
}

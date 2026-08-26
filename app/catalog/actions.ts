"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePageUser } from "@/lib/auth/session";
import { draftCropCare } from "@/lib/crops/draft";
import { DuplicateCropError } from "@/lib/crops/identity";
import {
  createStubCropRecord,
  getCropRecord,
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
  const identity = await requirePageUser();

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
    crop = await createStubCropRecord(input.name, input.variety);
  } catch (error) {
    if (error instanceof DuplicateCropError) {
      return {
        status: "error",
        message: error.message,
        existingCropId: error.existingCropId,
      };
    }
    console.error("Creating a crop stub failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The crop could not be created. Please try again.",
    };
  }

  await draftCropCare({
    cropId: crop.id,
    trigger: "catalog_create",
    userId: identity.id,
  });

  revalidatePath("/catalog");
  revalidatePath(`/catalog/${crop.id}`);
  redirect(`/catalog/${crop.id}`);
}

export async function draftCropWithGemini(
  _previousState: CropFormState,
  formData: FormData,
): Promise<CropFormState> {
  const identity = await requirePageUser();
  const cropId = String(formData.get("id") ?? "").trim();
  if (!cropId) {
    return { status: "error", message: "Crop is required." };
  }

  const existing = await getCropRecord(cropId);
  if (!existing) {
    return { status: "error", message: "Crop not found." };
  }
  if (existing.source !== "stub") {
    return {
      status: "error",
      message: "Draft with Gemini is only available before you save care numbers.",
    };
  }

  try {
    const draft = await draftCropCare({
      cropId,
      trigger: "catalog_redraft_stub",
      userId: identity.id,
    });
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${cropId}`);
    if (draft.outcome === "generated") {
      return { status: "success", message: draft.message };
    }
    if (draft.outcome === "stub_monthly_cap") {
      return { status: "error", message: draft.message };
    }
    return {
      status: "error",
      message: draft.message,
    };
  } catch (error) {
    console.error("Drafting a crop failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The crop could not be drafted. Please try again.",
    };
  }
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
    if (error instanceof DuplicateCropError) {
      return {
        status: "error",
        message: error.message,
        existingCropId: error.existingCropId,
      };
    }
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

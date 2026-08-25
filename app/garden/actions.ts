"use server";

import { revalidatePath } from "next/cache";

import { requirePageUser } from "@/lib/auth/session";
import {
  type GardenProfileFormState,
  parseGardenProfileForm,
} from "@/lib/garden/profile-validation";
import { saveGardenProfileRecord } from "@/lib/garden/profile-repository";
import {
  createSeasonRecord,
  getSeasonBoardRecord,
  overrideSectionExposureRecord,
  revertSectionExposureRecord,
  saveSeasonSectionsRecord,
} from "@/lib/garden/season-repository";
import { getCropRecord } from "@/lib/crops/repository";
import { cropCareCopyLabel } from "@/lib/crops/slug";
import {
  addPlantingRecord,
  removePlantingRecord,
} from "@/lib/garden/planting-repository";
import { sunMismatchWarning } from "@/lib/garden/sun-fit";
import {
  type PlantingFormState,
  parseAddPlantingForm,
  parseRemovePlantingForm,
} from "@/lib/garden/planting-validation";
import {
  type SeasonFormState,
  parseCreateSeasonForm,
  parseOverrideSectionForm,
  parseRevertSectionForm,
  parseSaveSectionsForm,
} from "@/lib/garden/season-validation";

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

export async function createSeason(
  _previousState: SeasonFormState,
  formData: FormData,
): Promise<SeasonFormState> {
  await requirePageUser();

  let input;
  try {
    input = parseCreateSeasonForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  try {
    await createSeasonRecord(input);
    revalidatePath("/garden");
    return {
      status: "success",
      message: input.markCurrent
        ? "Season created and marked current."
        : "Season created.",
    };
  } catch (error) {
    console.error("Creating a season failed.", error);
    const message =
      error instanceof Error && error.message.includes("unique")
        ? "A season with that name already exists."
        : error instanceof Error
          ? error.message
          : "The season could not be created. Please try again.";
    return { status: "error", message };
  }
}

export async function saveSeasonSections(
  _previousState: SeasonFormState,
  formData: FormData,
): Promise<SeasonFormState> {
  await requirePageUser();

  try {
    const board = await getSeasonBoardRecord();
    if (!board) {
      return {
        status: "error",
        message: "Save the garden profile and sun map before drawing sections.",
      };
    }

    const input = parseSaveSectionsForm(formData, board.bedLengthFt);
    await saveSeasonSectionsRecord(input);
    revalidatePath("/garden");
    return { status: "success", message: "Bed sections saved." };
  } catch (error) {
    console.error("Saving season sections failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The sections could not be saved. Please try again.",
    };
  }
}

export async function overrideSectionExposure(
  _previousState: SeasonFormState,
  formData: FormData,
): Promise<SeasonFormState> {
  await requirePageUser();

  try {
    const input = parseOverrideSectionForm(formData);
    await overrideSectionExposureRecord(input);
    revalidatePath("/garden");
    return { status: "success", message: "Section exposure overridden." };
  } catch (error) {
    console.error("Overriding section exposure failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The override could not be saved.",
    };
  }
}

export async function revertSectionExposure(
  _previousState: SeasonFormState,
  formData: FormData,
): Promise<SeasonFormState> {
  await requirePageUser();

  try {
    const { sectionId } = parseRevertSectionForm(formData);
    await revertSectionExposureRecord(sectionId);
    revalidatePath("/garden");
    return { status: "success", message: "Reverted to derived exposure." };
  } catch (error) {
    console.error("Reverting section exposure failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not revert to derived exposure.",
    };
  }
}

export async function addPlanting(
  _previousState: PlantingFormState,
  formData: FormData,
): Promise<PlantingFormState> {
  const identity = await requirePageUser();

  let input;
  try {
    input = parseAddPlantingForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  try {
    const result = await addPlantingRecord(input);
    const crop = result.crop;
    const created = result.created;
    if (!crop?.id) {
      return {
        status: "error",
        message: "Could not resolve or create a catalog crop for this planting.",
      };
    }

    let message = "Planting added.";

    if (created) {
      const { draftCropCare } = await import("@/lib/crops/draft");
      const draft = await draftCropCare({
        cropId: crop.id,
        trigger: "planting_first_sight",
        userId: identity.id,
      });
      if (draft.outcome === "generated") {
        message = "Planting added. Care fields drafted by Gemini.";
      } else if (draft.outcome === "stub_monthly_cap") {
        message = `Planting added with a blank care stub. ${draft.message}`;
      } else {
        message =
          "Planting added with a blank care stub — Gemini could not fill care fields.";
      }
    }

    const cropAfter = (await getCropRecord(crop.id)) ?? crop;
    const warning = sunMismatchWarning({
      cropLabel: cropCareCopyLabel(cropAfter.name, cropAfter.variety),
      sunPreference: cropAfter.sunPreference,
      locationExposure: result.locationSunExposure,
    });

    revalidatePath("/garden");
    revalidatePath(`/garden/${input.locationId}`);
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${crop.id}`);
    return { status: "success", message, warning: warning ?? undefined };
  } catch (error) {
    console.error("Adding a planting failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The planting could not be saved. Please try again.",
    };
  }
}

export async function removePlanting(
  _previousState: PlantingFormState,
  formData: FormData,
): Promise<PlantingFormState> {
  await requirePageUser();

  let input;
  try {
    input = parseRemovePlantingForm(formData);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check the form and try again.",
    };
  }

  try {
    await removePlantingRecord(input);
    revalidatePath("/garden");
    revalidatePath(`/garden/${input.locationId}`);
    return {
      status: "success",
      message: "Planting marked removed and kept in history.",
    };
  } catch (error) {
    console.error("Removing a planting failed.", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The planting could not be updated. Please try again.",
    };
  }
}

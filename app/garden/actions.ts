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

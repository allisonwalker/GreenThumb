import { requireIsoCalendarDate } from "./local-date";
import {
  SUN_EXPOSURES,
  validateSectionCoverage,
  type SectionRangeInput,
  type SunExposure,
} from "./sun-exposure";

export type SeasonFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export type CreateSeasonInput = {
  name: string;
  startsOn: string;
  endsOn: string;
  markCurrent: boolean;
};

export type SectionDraftInput = SectionRangeInput & {
  id?: string;
};

export type SaveSectionsInput = {
  seasonId: string;
  sections: SectionDraftInput[];
};

export type OverrideSectionInput = {
  sectionId: string;
  sunExposure: SunExposure;
};

function requiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function requiredDate(formData: FormData, name: string, label: string) {
  const value = requiredText(formData, name, label);
  return requireIsoCalendarDate(value, label);
}

export function parseCreateSeasonForm(formData: FormData): CreateSeasonInput {
  const name = requiredText(formData, "name", "Season name");
  const startsOn = requiredDate(formData, "startsOn", "Start date");
  const endsOn = requiredDate(formData, "endsOn", "End date");
  const markCurrent = formData
    .getAll("markCurrent")
    .map(String)
    .includes("true");

  if (endsOn < startsOn) {
    throw new Error("End date must be on or after the start date.");
  }

  return { name, startsOn, endsOn, markCurrent };
}

export function parseSaveSectionsForm(
  formData: FormData,
  bedLengthFt: number,
): SaveSectionsInput {
  const seasonId = requiredText(formData, "seasonId", "Season");
  const ids = formData.getAll("sectionId").map((value) => String(value));
  const names = formData.getAll("sectionName");
  const starts = formData.getAll("sectionStartFt");
  const ends = formData.getAll("sectionEndFt");

  if (
    names.length !== starts.length ||
    names.length !== ends.length ||
    (ids.length > 0 && ids.length !== names.length)
  ) {
    throw new Error("Each section needs a name, start, and end.");
  }

  if (names.length === 0) {
    throw new Error("Add at least one section covering the bed.");
  }

  const sections = names.map((nameValue, index) => {
    const name = String(nameValue).trim() || `Section ${index + 1}`;
    const startFt = Number(starts[index]);
    const endFt = Number(ends[index]);
    const id = ids[index]?.trim();

    if (!Number.isFinite(startFt) || !Number.isFinite(endFt)) {
      throw new Error(`${name} needs numeric boundaries.`);
    }

    return {
      ...(id ? { id } : {}),
      name,
      startFt,
      endFt,
    };
  });

  const uniqueNames = new Set(sections.map((section) => section.name));
  if (uniqueNames.size !== sections.length) {
    throw new Error("Section names must be unique within a season.");
  }

  return {
    seasonId,
    sections: validateSectionCoverage(sections, bedLengthFt),
  };
}

export function parseOverrideSectionForm(
  formData: FormData,
): OverrideSectionInput {
  const sectionId = requiredText(formData, "sectionId", "Section");
  const sunExposure = requiredText(
    formData,
    "sunExposure",
    "Sun exposure",
  ) as SunExposure;

  if (!SUN_EXPOSURES.includes(sunExposure)) {
    throw new Error("Choose a valid sun exposure for the override.");
  }

  return { sectionId, sunExposure };
}

export function parseRevertSectionForm(formData: FormData): { sectionId: string } {
  return {
    sectionId: requiredText(formData, "sectionId", "Section"),
  };
}

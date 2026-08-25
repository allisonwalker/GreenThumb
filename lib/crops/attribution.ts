import type { CropRecord, CropSource } from "./types";

/**
 * Attribution from `source` + `generated_by_*`. Saving an edit must not clear
 * `generated_by_*` so Gemini credit survives household corrections.
 */
export function cropAttributionCopy(input: {
  source: CropSource;
  generatedByProvider: string | null;
}): string {
  const fromGemini =
    input.generatedByProvider?.trim().toLowerCase() === "gemini";

  if (input.source === "stub") {
    return "Stub — fields can stay blank until you know them.";
  }
  if (input.source === "generated" && fromGemini) {
    return "Drafted by Gemini";
  }
  if (input.source === "edited" && fromGemini) {
    return "Drafted by Gemini, edited by you";
  }
  if (input.source === "edited") {
    return "Edited by you";
  }
  return "Generated — not yet edited.";
}

export function cropAttributionFromRecord(crop: CropRecord): string {
  return cropAttributionCopy({
    source: crop.source,
    generatedByProvider: crop.generatedByProvider,
  });
}

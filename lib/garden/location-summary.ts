import { cropIdentityLabel } from "@/lib/crops/slug";

export const EMPTY_PLANTING_SUMMARY = "Nothing planted";

export type LocationPlantingCrop = {
  cropName: string;
  variety: string | null;
};

export function formatLocationPlantingSummary(
  crops: LocationPlantingCrop[],
): string {
  if (crops.length === 0) {
    return EMPTY_PLANTING_SUMMARY;
  }

  const labels = [
    ...new Set(
      crops.map((crop) => cropIdentityLabel(crop.cropName, crop.variety)),
    ),
  ].sort((left, right) => left.localeCompare(right));

  return labels.join(", ");
}

export function groupLocationsForGardenDashboard<
  T extends { kind: "bed_section" | "pot" },
>(locations: T[]): { sections: T[]; pots: T[] } {
  return {
    sections: locations.filter((location) => location.kind === "bed_section"),
    pots: locations.filter((location) => location.kind === "pot"),
  };
}

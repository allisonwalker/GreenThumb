export type PlantingFormState =
  | { status: "idle" }
  | { status: "success"; message: string; warning?: string }
  | { status: "error"; message: string };

export type PlantingMethod = "seed" | "transplant";

export const PLANTING_METHODS: readonly PlantingMethod[] = [
  "seed",
  "transplant",
] as const;

export type AddPlantingInput = {
  locationId: string;
  cropName: string;
  variety: string | null;
  method: PlantingMethod;
  plantedOn: string;
};

export type RemovePlantingInput = {
  plantingId: string;
  locationId: string;
  removedOn: string;
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
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} must be a valid date.`);
  }
  return value;
}

export function parseAddPlantingForm(formData: FormData): AddPlantingInput {
  const locationId = requiredText(formData, "locationId", "Location");
  const cropName = requiredText(formData, "cropName", "Crop name");
  const varietyRaw = String(formData.get("variety") ?? "").trim();
  const method = requiredText(formData, "method", "Method") as PlantingMethod;
  const plantedOn = requiredDate(formData, "plantedOn", "Planted date");

  if (!PLANTING_METHODS.includes(method)) {
    throw new Error("Method must be seed or transplant.");
  }

  return {
    locationId,
    cropName,
    variety: varietyRaw.length > 0 ? varietyRaw : null,
    method,
    plantedOn,
  };
}

export function parseRemovePlantingForm(
  formData: FormData,
): RemovePlantingInput {
  const plantingId = requiredText(formData, "plantingId", "Planting");
  const locationId = requiredText(formData, "locationId", "Location");
  const removedOn = requiredDate(formData, "removedOn", "Removal date");

  return { plantingId, locationId, removedOn };
}

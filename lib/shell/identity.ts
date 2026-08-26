export const PRODUCT_LABEL = "Jory Journal";
export const DEFAULT_GARDEN_NAME = "Allison and Spencer's Garden";

const LEGACY_PRODUCT_GARDEN_NAMES = new Set([
  "GreenThumb Garden",
  "Green Thumb Garden",
  "Jory Journal Garden",
]);

export const PRIMARY_NAV_HREFS = [
  "/today",
  "/garden",
  "/catalog",
  "/log",
  "/ask",
] as const;

export function resolveGardenDisplayName(
  storedName: string | null | undefined,
): string {
  const trimmed = storedName?.trim();
  if (!trimmed || LEGACY_PRODUCT_GARDEN_NAMES.has(trimmed)) {
    return DEFAULT_GARDEN_NAME;
  }
  return trimmed;
}

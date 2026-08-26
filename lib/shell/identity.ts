export const PRODUCT_LABEL = "Jory Journal";
export const DEFAULT_GARDEN_NAME = "Jory Journal Garden";

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
  return trimmed ? trimmed : DEFAULT_GARDEN_NAME;
}

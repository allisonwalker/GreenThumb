export const GARDEN_PATH = "/garden";
export const GARDEN_SETUP_PATH = "/garden/setup";
export const GARDEN_SETUP_SEGMENT = "setup";

export function gardenLocationPath(locationId: string): string {
  return `${GARDEN_PATH}/${locationId}`;
}

/**
 * Empty Garden is "no current locations" (no current bed sections and no pots),
 * not a missing garden singleton row. Only GET /garden should follow this.
 */
export function emptyGardenDashboardRedirect(
  currentLocationCount: number,
): typeof GARDEN_SETUP_PATH | null {
  if (currentLocationCount === 0) {
    return GARDEN_SETUP_PATH;
  }
  return null;
}

const LOCATION_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGardenLocationIdSegment(segment: string): boolean {
  return LOCATION_ID_UUID.test(segment);
}

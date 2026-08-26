export const GARDEN_PATH = "/garden";
export const GARDEN_SETUP_PATH = "/garden/setup";
export const GARDEN_SETUP_SEGMENT = "setup";

const LOCATION_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGardenLocationIdSegment(segment: string): boolean {
  return LOCATION_ID_UUID.test(segment);
}

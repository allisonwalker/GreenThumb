import { isActionType, type ActionType } from "./action-types";
import { zonedDateTimeToUtc } from "./local-date";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DETAIL_LENGTH = 2000;
const MAX_FUTURE_MS = 15 * 60 * 1000;
const MAX_PAST_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export type ActionLogInput = {
  locationId: string;
  actionType: ActionType;
  detail: string | null;
  occurredAt: Date;
  timeZone: string;
};

export type ActionLogFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function requiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function optionalText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    return null;
  }
  if (value.length > MAX_DETAIL_LENGTH) {
    throw new Error(`${label} must be ${MAX_DETAIL_LENGTH} characters or fewer.`);
  }
  return value;
}

function requiredUuid(formData: FormData, name: string, label: string) {
  const value = requiredText(formData, name, label);
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} is not valid.`);
  }
  return value;
}

export function parseActionLogForm(
  formData: FormData,
  now: Date = new Date(),
): ActionLogInput {
  const locationId = requiredUuid(formData, "locationId", "Location");
  const actionType = requiredText(formData, "actionType", "Action");
  if (!isActionType(actionType)) {
    throw new Error("Choose a valid action type.");
  }

  const timeZone = requiredText(formData, "timeZone", "Timezone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error("Timezone must be a valid IANA name.");
  }

  const occurredLocal = String(formData.get("occurredAt") ?? "").trim();
  const occurredAt = occurredLocal
    ? zonedDateTimeToUtc(occurredLocal, timeZone)
    : now;

  if (occurredAt.getTime() - now.getTime() > MAX_FUTURE_MS) {
    throw new Error("The time cannot be in the future.");
  }
  if (now.getTime() - occurredAt.getTime() > MAX_PAST_MS) {
    throw new Error("Choose a time within the last two years.");
  }

  return {
    locationId,
    actionType,
    detail: optionalText(formData, "detail", "Detail"),
    occurredAt,
    timeZone,
  };
}

export function parseVoidActionLogForm(formData: FormData) {
  return {
    actionLogId: requiredUuid(formData, "actionLogId", "Log entry"),
  };
}

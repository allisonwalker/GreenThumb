export const ACTION_TYPES = [
  "watered",
  "fertilized",
  "pruned",
  "harvested",
  "planted",
  "observed",
  "treated",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  watered: "Watered",
  fertilized: "Fertilized",
  pruned: "Pruned",
  harvested: "Harvested",
  planted: "Planted",
  observed: "Observed",
  treated: "Treated",
};

export function isActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}

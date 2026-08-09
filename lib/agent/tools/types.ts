export type ToolExecutionContext = {
  gardenId?: string;
  now?: Date;
};

export const emptyObjectSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

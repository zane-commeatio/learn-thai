import type { z, ZodType } from "zod";

export class InvalidRequestError extends Error {
  readonly code = "invalid_request" as const;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
    this.name = "InvalidRequestError";
  }
}

export function parseSchema<T>(
  schema: ZodType<T>,
  input: unknown,
  message = "Invalid request",
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidRequestError(message, {
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export function parseEnumValue<T extends string>(
  schema: z.ZodEnum<Record<string, T>>,
  input: unknown,
  field: string,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidRequestError(`Invalid enum value for ${field}`, {
      field,
      allowedValues: schema.options,
    });
  }

  return parsed.data;
}

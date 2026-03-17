import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_request",
  "invalid_state",
  "conflict",
  "rate_limited",
  "processing_failed",
  "validation_failed",
  "content_restricted",
  "takedown_pending",
  "legal_hold",
]);

export const ApiErrorEnvelopeSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
): Response {
  const body: ApiErrorEnvelope = details === undefined
    ? { code, message }
    : { code, message, details };

  return Response.json(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function invalidRequest(message: string, details?: unknown): Response {
  return jsonError("invalid_request", message, 400, details);
}

export function processingFailed(message: string, details?: unknown): Response {
  return jsonError("processing_failed", message, 500, details);
}

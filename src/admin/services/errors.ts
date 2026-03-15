export type AdminServiceErrorCode =
  | "invalid_request"
  | "not_found"
  | "invalid_state"
  | "conflict"
  | "processing_failed";

export class AdminServiceError extends Error {
  constructor(
    public readonly code: AdminServiceErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AdminServiceError";
  }
}

export function isAdminServiceError(error: unknown): error is AdminServiceError {
  return error instanceof AdminServiceError;
}

export function getAdminServiceErrorStatus(error: AdminServiceError): number {
  if (error.code === "invalid_request") {
    return 400;
  }

  if (error.code === "not_found") {
    return 404;
  }

  if (error.code === "invalid_state" || error.code === "conflict") {
    return 409;
  }

  return 500;
}

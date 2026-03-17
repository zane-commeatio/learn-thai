import { ZodError } from "zod";
import {
  invalidRequest,
  jsonError,
  processingFailed,
} from "../src/contracts/api-error";
import {
  getAdminServiceErrorStatus,
  isAdminServiceError,
} from "../src/admin/services/errors";
import { getAdminSession } from "./admin-auth";
import type { AdminSessionPayload } from "./session";

export async function requireAdminApiSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("ADMIN_API_UNAUTHORIZED");
  }

  return session;
}

export function isAdminApiUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.message === "ADMIN_API_UNAUTHORIZED";
}

export function unauthorizedApiResponse(message = "Admin session required"): Response {
  return jsonError("unauthorized", message, 401);
}

export function adminRouteErrorResponse(
  error: unknown,
  fallbackMessage: string,
): Response {
  if (isAdminApiUnauthorizedError(error)) {
    return unauthorizedApiResponse();
  }

  if (error instanceof ZodError) {
    return invalidRequest("Invalid request", error.flatten());
  }

  if (isAdminServiceError(error)) {
    return jsonError(
      error.code,
      error.message,
      getAdminServiceErrorStatus(error),
      error.details,
    );
  }

  return processingFailed(
    error instanceof Error ? error.message : fallbackMessage,
  );
}

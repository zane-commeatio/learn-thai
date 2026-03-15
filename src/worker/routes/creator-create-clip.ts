import { CreateClipRequestSchema } from "../../contracts/creator";
import { invalidRequest } from "../../contracts/api-error";
import {
  InvalidRequestError,
  parseSchema,
} from "../../contracts/validation";
import type { ClipsRepository } from "../../domain/repositories/clips-repository";

const DEFAULT_OWNER_ID = "system";

export type CreateClipRouteDependencies = {
  clipsRepository: ClipsRepository;
};

function toInvalidRequest(error: unknown): Response | null {
  if (error instanceof InvalidRequestError) {
    return invalidRequest(error.message, error.details);
  }

  return null;
}

export async function handleCreatorCreateClip(
  request: Request,
  dependencies: CreateClipRouteDependencies,
): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidRequest("Request body must be valid JSON");
  }

  let parsed;
  try {
    parsed = parseSchema(CreateClipRequestSchema, payload, "Invalid request body");
  } catch (error) {
    const response = toInvalidRequest(error);
    if (response) {
      return response;
    }
    throw error;
  }

  const clipId = crypto.randomUUID();
  await dependencies.clipsRepository.create({
    id: clipId,
    title: parsed.title,
    ownerId: DEFAULT_OWNER_ID,
    sourceType: parsed.source_type,
    rightsStatus: parsed.rights_status,
  });

  return Response.json(
    { clipId },
    {
      status: 201,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}

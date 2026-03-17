import { describe, expect, it } from "vitest";
import { handleRequest } from "../../src/worker/app";
import type {
  ClipRecord,
  ClipsRepository,
  CreateClipInput,
} from "../../src/domain/repositories/clips-repository";

class InMemoryClipsRepository implements ClipsRepository {
  createdClips: CreateClipInput[] = [];

  async create(input: CreateClipInput): Promise<ClipRecord> {
    this.createdClips.push(input);

    return {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getById(id: string): Promise<ClipRecord | null> {
    void id;
    return null;
  }

  async deleteById(id: string): Promise<void> {
    void id;
  }
}

function makeDependencies(repository: InMemoryClipsRepository) {
  return {
    createClipsRepository: () => repository,
  };
}

describe("POST /api/creator/clips", () => {
  it("returns 201 with clipId for valid payload and persists title", async () => {
    const repository = new InMemoryClipsRepository();
    const request = new Request("https://example.com/api/creator/clips", {
      method: "POST",
      body: JSON.stringify({
        title: "Morning market greetings",
        source_type: "original",
        rights_status: "cleared",
      }),
    });

    const response = await handleRequest(request, {}, makeDependencies(repository));
    const body = (await response.json()) as { clipId: string };

    expect(response.status).toBe(201);
    expect(body.clipId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(repository.createdClips).toHaveLength(1);
    expect(repository.createdClips[0]).toMatchObject({
      title: "Morning market greetings",
      sourceType: "original",
      rightsStatus: "cleared",
      ownerId: "system",
    });
  });

  it("returns 400 invalid_request when title is missing", async () => {
    const repository = new InMemoryClipsRepository();
    const request = new Request("https://example.com/api/creator/clips", {
      method: "POST",
      body: JSON.stringify({
        source_type: "original",
        rights_status: "cleared",
      }),
    });

    const response = await handleRequest(request, {}, makeDependencies(repository));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_request");
    expect(repository.createdClips).toHaveLength(0);
  });

  it("returns 400 invalid_request when enum values are invalid", async () => {
    const repository = new InMemoryClipsRepository();
    const request = new Request("https://example.com/api/creator/clips", {
      method: "POST",
      body: JSON.stringify({
        title: "Bangkok skyline",
        source_type: "fan_edit",
        rights_status: "allowed",
      }),
    });

    const response = await handleRequest(request, {}, makeDependencies(repository));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_request",
      message: "Invalid request body",
    });
    expect(repository.createdClips).toHaveLength(0);
  });

  it("returns 400 invalid_request for malformed JSON", async () => {
    const repository = new InMemoryClipsRepository();
    const request = new Request("https://example.com/api/creator/clips", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{",
    });

    const response = await handleRequest(request, {}, makeDependencies(repository));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "invalid_request",
      message: "Request body must be valid JSON",
    });
    expect(repository.createdClips).toHaveLength(0);
  });
});

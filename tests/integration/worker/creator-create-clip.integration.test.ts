import { describe, expect, it } from "vitest";
import { createDb } from "../../../src/db/client";
import { DrizzleClipsRepository } from "../../../src/db/repositories/clips-repository";
import { handleRequest } from "../../../src/worker/app";

const databaseUrl = process.env.TEST_DATABASE_URL;

async function eventuallyGetClip(
  clipsRepository: DrizzleClipsRepository,
  clipId: string,
) {
  for (let i = 0; i < 15; i += 1) {
    const clip = await clipsRepository.getById(clipId);
    if (clip) {
      return clip;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

if (!databaseUrl) {
  describe.skip("POST /api/creator/clips integration", () => {
    it("requires TEST_DATABASE_URL", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("POST /api/creator/clips integration", () => {
    const clipsRepository = new DrizzleClipsRepository(createDb(databaseUrl));

    it("persists clip row and returns clipId", async () => {
      const request = new Request("https://example.com/api/creator/clips", {
        method: "POST",
        body: JSON.stringify({
          title: "Street food intro",
          source_type: "original",
          rights_status: "cleared",
        }),
      });

      const response = await handleRequest(
        request,
        {},
        { createClipsRepository: () => clipsRepository },
      );

      const body = (await response.json()) as { clipId: string };
      const created = await eventuallyGetClip(clipsRepository, body.clipId);

      expect(response.status).toBe(201);
      expect(created).not.toBeNull();
      expect(created?.title).toBe("Street food intro");
      expect(created?.sourceType).toBe("original");
      expect(created?.rightsStatus).toBe("cleared");
      expect(created?.createdAt).toBeInstanceOf(Date);
      expect(created?.updatedAt).toBeInstanceOf(Date);
    }, 15000);

    it("rejects invalid body with invalid_request envelope", async () => {
      const request = new Request("https://example.com/api/creator/clips", {
        method: "POST",
        body: JSON.stringify({
          title: "  ",
          source_type: "original",
          rights_status: "cleared",
        }),
      });

      const response = await handleRequest(
        request,
        {},
        { createClipsRepository: () => clipsRepository },
      );

      const body = (await response.json()) as { code: string; message: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("invalid_request");
      expect(body.message).toBe("Invalid request body");
    }, 15000);
  });
}

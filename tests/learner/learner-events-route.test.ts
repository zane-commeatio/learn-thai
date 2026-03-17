import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();
const recordLearnerEventMock = vi.fn();

vi.mock("../../lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("../../src/learner/services/record-learner-event", () => ({
  recordLearnerEvent: recordLearnerEventMock,
}));

describe("POST /api/learner/events", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getDbMock.mockReturnValue({});
  });

  it("returns the shared invalid_request envelope for invalid analytics payloads", async () => {
    const route = await import("../../app/api/learner/events/route");
    const response = await route.POST(new Request("https://example.com/api/learner/events", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "",
        name: "not_a_valid_event",
      }),
    }));
    const body = await response.json() as {
      code: string;
      message: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_request",
      message: "Learner analytics payload is invalid.",
    });
    expect(body.details?.fieldErrors).toBeDefined();
    expect(recordLearnerEventMock).not.toHaveBeenCalled();
  });

  it("returns processing_failed when event persistence throws", async () => {
    recordLearnerEventMock.mockRejectedValueOnce(new Error("database unavailable"));

    const route = await import("../../app/api/learner/events/route");
    const response = await route.POST(new Request("https://example.com/api/learner/events", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session_1",
        name: "clip_play_started",
        clipId: "clip_1",
      }),
    }));
    const body = await response.json() as { code: string; message: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: "processing_failed",
      message: "database unavailable",
    });
  });
});

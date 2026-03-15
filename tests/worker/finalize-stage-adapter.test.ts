import { beforeEach, describe, expect, it, vi } from "vitest";

const getObjectBufferMock = vi.fn();
const putObjectMock = vi.fn();

vi.mock("../../lib/storage", () => ({
  getObjectBuffer: getObjectBufferMock,
  putObject: putObjectMock,
}));

describe("NodeFinalizeStageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("builds generated and edited payload artifacts", async () => {
    getObjectBufferMock
      .mockResolvedValueOnce(Buffer.from(JSON.stringify({
        segments: [
          { index: 0, text: "สวัสดีค่ะ", startMs: 0, endMs: 900 },
          { index: 1, text: "ขอบคุณค่ะ", startMs: 901, endMs: 1600 },
        ],
      }), "utf8"))
      .mockResolvedValueOnce(Buffer.from(JSON.stringify({
        translations: [
          { segmentIndex: 0, englishText: "Hello." },
          { segmentIndex: 1, englishText: "Thank you." },
        ],
      }), "utf8"));

    const { NodeFinalizeStageAdapter } = await import("../../src/worker-node/finalize-stage-adapter");
    const adapter = new NodeFinalizeStageAdapter();

    const result = await adapter.run(
      { id: "job_1", clipId: "clip_1", state: "processing", stage: "finalize", errorPayload: null, artifactRefs: null, lockToken: null, lockExpiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      {
        segmentJsonPath: "clips/clip_1/jobs/job_1/segments.json",
        translationJsonPath: "clips/clip_1/jobs/job_1/translations.json",
        normalizedVideoPath: "clips/clip_1/jobs/job_1/normalized.mp4",
        audioWavPath: "clips/clip_1/jobs/job_1/audio.wav",
        posterImagePath: "clips/clip_1/jobs/job_1/poster.jpg",
      },
    );

    expect(putObjectMock).toHaveBeenCalledTimes(2);
    const generatedPayload = JSON.parse(String(putObjectMock.mock.calls[0]?.[0]?.body));
    const editedPayload = JSON.parse(String(putObjectMock.mock.calls[1]?.[0]?.body));

    expect(generatedPayload.review).toEqual({ status: "generated", hasManualChanges: false });
    expect(generatedPayload.thumbnail).toEqual({
      imagePath: "clips/clip_1/jobs/job_1/poster.jpg",
      source: "generated",
    });
    expect(generatedPayload.segments).toEqual([
      {
        index: 0,
        text: "สวัสดีค่ะ",
        startMs: 0,
        endMs: 900,
        translation: { englishText: "Hello.", source: "generated" },
      },
      {
        index: 1,
        text: "ขอบคุณค่ะ",
        startMs: 901,
        endMs: 1600,
        translation: { englishText: "Thank you.", source: "generated" },
      },
    ]);
    expect(editedPayload.review).toEqual({ status: "edited", hasManualChanges: false });
    expect(result).toEqual({
      generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
      editedPayloadPath: "clips/clip_1/jobs/job_1/edited-payload.json",
      segmentCount: 2,
      translationCount: 2,
      thumbnailPath: "clips/clip_1/jobs/job_1/poster.jpg",
    });
  });

  it("fails when a translation is missing for a segment", async () => {
    getObjectBufferMock
      .mockResolvedValueOnce(Buffer.from(JSON.stringify({
        segments: [
          { index: 0, text: "สวัสดีค่ะ", startMs: 0, endMs: 900 },
          { index: 1, text: "ขอบคุณค่ะ", startMs: 901, endMs: 1600 },
        ],
      }), "utf8"))
      .mockResolvedValueOnce(Buffer.from(JSON.stringify({
        translations: [
          { segmentIndex: 0, englishText: "Hello." },
        ],
      }), "utf8"));

    const { NodeFinalizeStageAdapter } = await import("../../src/worker-node/finalize-stage-adapter");
    const adapter = new NodeFinalizeStageAdapter();

    await expect(adapter.run(
      { id: "job_1", clipId: "clip_1", state: "processing", stage: "finalize", errorPayload: null, artifactRefs: null, lockToken: null, lockExpiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      {
        segmentJsonPath: "clips/clip_1/jobs/job_1/segments.json",
        translationJsonPath: "clips/clip_1/jobs/job_1/translations.json",
        normalizedVideoPath: null,
        audioWavPath: null,
        posterImagePath: null,
      },
    )).rejects.toMatchObject({
      code: "finalize_translation_mismatch",
    });
  });
});

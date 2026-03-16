import { describe, expect, it, vi } from "vitest";
import { buildClipDetailViewModel } from "../../app/admin/clips/[clipId]/clip-detail-view-model";

describe("buildClipDetailViewModel", () => {
  it("builds finalize preview content and downloads from the latest job artifacts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T13:00:00.000Z"));

    const result = buildClipDetailViewModel({
      clip: {
        id: "clip_1",
        title: "Greeting clip",
        sourceType: "original",
        rightsStatus: "unknown",
      },
      jobs: [
        {
          id: "job_1",
          state: "needs_review",
          stage: "finalize",
          updatedAt: new Date("2026-03-15T12:45:00.000Z"),
          errorPayload: null,
          artifactRefs: {
            normalizedVideoPath: "clips/clip_1/jobs/job_1/normalized.mp4",
            posterImagePath: "clips/clip_1/jobs/job_1/poster.jpg",
            audioWavPath: "clips/clip_1/jobs/job_1/audio.wav",
            asr: {
              asrJsonPath: "clips/clip_1/jobs/job_1/asr.json",
              transcriptPreview: "สวัสดีครับ",
              segmentCount: 2,
              wordCount: 4,
              language: "th",
            },
            segment: {
              segmentJsonPath: "clips/clip_1/jobs/job_1/segments.json",
              segmentCount: 2,
              preview: [{ index: 0, text: "สวัสดีครับ", startMs: 0, endMs: 900 }],
            },
            translate: {
              translationJsonPath: "clips/clip_1/jobs/job_1/translations.json",
              translationCount: 2,
              preview: [{ segmentIndex: 0, sourceText: "สวัสดีครับ", englishText: "Hello." }],
            },
            finalize: {
              generatedPayloadPath: "clips/clip_1/jobs/job_1/generated-payload.json",
              editedPayloadPath: "clips/clip_1/jobs/job_1/edited-payload.json",
              segmentCount: 2,
              translationCount: 2,
              thumbnailPath: "clips/clip_1/jobs/job_1/poster.jpg",
            },
          },
        },
      ],
    });

    expect(result.currentStatus).toMatchObject({
      jobId: "job_1",
      state: "needs_review",
      stage: "finalize",
      canRetry: false,
      failureTooltip: null,
      failureMessage: null,
    });

    const finalizeStage = result.stages.find((stage) => stage.key === "finalize");
    expect(finalizeStage).toMatchObject({
      progress: "needs_review",
      retryJobId: null,
      showLockedAction: false,
      downloads: [
        {
          label: "Download generated payload",
          href: "/api/admin/jobs/job_1/artifacts/finalize/generated",
          pendingLabel: "Download generated payload (not ready)",
        },
        {
          label: "Download edited payload",
          href: "/api/admin/jobs/job_1/artifacts/finalize/edited",
          pendingLabel: "Download edited payload (not ready)",
        },
      ],
      content: {
        kind: "finalize",
        segmentCount: 2,
        translationCount: 2,
        thumbnailPath: "clips/clip_1/jobs/job_1/poster.jpg",
        artifactUrl: "/api/admin/jobs/job_1/artifacts/finalize/edited",
        normalizedVideoUrl: "/api/admin/jobs/job_1/artifacts/audio/normalized",
        posterUrl: "/api/admin/jobs/job_1/artifacts/audio/poster",
      },
    });

    expect(result.reviewChecklist).toMatchObject({
      isReviewReady: false,
      summary: "1 system check still failing. Fix these before relying on this clip as publish-ready input.",
    });
    expect(result.reviewChecklist.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "media",
        status: "pass",
      }),
      expect.objectContaining({
        key: "rights",
        status: "fail",
      }),
      expect.objectContaining({
        key: "finalize",
        status: "pass",
      }),
    ]));

    vi.useRealTimers();
  });

  it("marks the active failed stage as retryable and keeps later stages pending", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T13:00:00.000Z"));

    const result = buildClipDetailViewModel({
      clip: {
        id: "clip_2",
        title: "Conversation clip",
        sourceType: "licensed",
        rightsStatus: "cleared",
      },
      jobs: [
        {
          id: "job_failed",
          state: "failed",
          stage: "translate",
          updatedAt: new Date("2026-03-15T12:40:00.000Z"),
          errorPayload: {
            code: "translation_provider_error",
            message: "OpenRouter rate limited",
          },
          artifactRefs: null,
        },
      ],
    });

    expect(result.currentStatus).toMatchObject({
      jobId: "job_failed",
      state: "failed",
      stage: "translate",
      canRetry: true,
      failureTooltip: "translation_provider_error: OpenRouter rate limited",
      failureMessage: "OpenRouter rate limited",
    });

    const audioStage = result.stages.find((stage) => stage.key === "audio");
    const translateStage = result.stages.find((stage) => stage.key === "translate");
    const finalizeStage = result.stages.find((stage) => stage.key === "finalize");

    expect(audioStage).toMatchObject({
      progress: "completed",
      retryJobId: null,
      showLockedAction: true,
    });
    expect(translateStage).toMatchObject({
      progress: "failed",
      retryJobId: "job_failed",
      showLockedAction: false,
    });
    expect(finalizeStage).toMatchObject({
      progress: "pending",
    });
    expect(result.reviewChecklist.isReviewReady).toBe(false);
    expect(result.reviewChecklist.items.find((item) => item.key === "finalize")).toMatchObject({
      status: "fail",
    });

    vi.useRealTimers();
  });
});

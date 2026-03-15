import { describe, expect, it } from "vitest";
import {
  PipelineStageSchema,
  ProcessingJobSchema,
  ProcessingStateSchema,
} from "../../src/contracts/pipeline";
import { InvalidRequestError, parseEnumValue } from "../../src/contracts/validation";

describe("pipeline contracts", () => {
  it("accepts legal stage and state enum values", () => {
    expect(PipelineStageSchema.parse("audio")).toBe("audio");
    expect(ProcessingStateSchema.parse("processing")).toBe("processing");
  });

  it("validates processing job payload", () => {
    const job = ProcessingJobSchema.parse({
      id: "job_1",
      clipId: "clip_1",
      state: "processing",
      stage: "audio",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(job.id).toBe("job_1");
    expect(job.stage).toBe("audio");
  });

  it("rejects invalid enum values with invalid_request", () => {
    try {
      parseEnumValue(PipelineStageSchema, "bad_stage", "stage");
      throw new Error("expected invalid enum to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidRequestError);
      const invalidRequestError = error as InvalidRequestError;
      expect(invalidRequestError.code).toBe("invalid_request");
      expect(invalidRequestError.details).toEqual({
        field: "stage",
        allowedValues: ["audio", "asr", "segment", "translate", "finalize"],
      });
    }
  });
});

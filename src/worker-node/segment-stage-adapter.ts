import { getObjectBuffer, putObject } from "../../lib/storage";
import type { ProcessingJobRecord } from "../domain/repositories/processing-jobs-repository";
import type {
  SegmentShapingStageAdapter,
  TranscriptSegment,
  SegmentStageArtifactRefs,
} from "../worker/stages/segment-shaping";

type AsrRawSegment = Record<string, unknown>;

type AsrArtifactPayload = {
  transcript?: unknown;
  raw?: {
    segments?: unknown;
  } | null;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toMs(value: number, source: "start_end" | "t0_t1"): number {
  if (source === "start_end") {
    return Math.round(value * 1000);
  }

  if (value > 10_000) {
    return Math.round(value);
  }

  return Math.round(value * 10);
}

function extractTiming(segment: AsrRawSegment): { startMs: number | null; endMs: number | null } {
  const start = asNumber(segment.start);
  const end = asNumber(segment.end);
  if (start !== null && end !== null) {
    return {
      startMs: toMs(start, "start_end"),
      endMs: toMs(end, "start_end"),
    };
  }

  const t0 = asNumber(segment.t0);
  const t1 = asNumber(segment.t1);
  if (t0 !== null && t1 !== null) {
    return {
      startMs: toMs(t0, "t0_t1"),
      endMs: toMs(t1, "t0_t1"),
    };
  }

  return { startMs: null, endMs: null };
}

function parseAsrPayload(buffer: Buffer): AsrArtifactPayload {
  const payload = JSON.parse(buffer.toString("utf8")) as unknown;
  if (!payload || typeof payload !== "object") {
    throw new SegmentStageError("segment_invalid_asr_payload", "ASR artifact payload is invalid");
  }

  return payload as AsrArtifactPayload;
}

function buildSegments(payload: AsrArtifactPayload): TranscriptSegment[] {
  const rawSegments = payload.raw?.segments;
  if (!Array.isArray(rawSegments)) {
    throw new SegmentStageError(
      "segment_invalid_asr_payload",
      "ASR payload missing raw.segments (ASR contract violation)",
    );
  }

  const segments: TranscriptSegment[] = [];
  for (const [index, item] of rawSegments.entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const segment = item as AsrRawSegment;
    const text = asString(segment.text);
    if (!text) {
      continue;
    }

    const timing = extractTiming(segment);
    segments.push({
      index,
      text,
      startMs: timing.startMs,
      endMs: timing.endMs,
    });
  }

  if (segments.length === 0) {
    throw new SegmentStageError("segment_invalid_asr_payload", "ASR payload produced no transcript segments");
  }

  return segments;
}

export class SegmentStageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NodeSegmentShapingStageAdapter implements SegmentShapingStageAdapter {
  async run(job: ProcessingJobRecord, input: { asrJsonPath: string }): Promise<SegmentStageArtifactRefs> {
    const asrBuffer = await getObjectBuffer(input.asrJsonPath);
    if (!asrBuffer) {
      throw new SegmentStageError("segment_input_missing", `Missing ASR artifact: ${input.asrJsonPath}`);
    }

    try {
      const payload = parseAsrPayload(asrBuffer);
      const segments = buildSegments(payload);
      const segmentJsonPath = `clips/${job.clipId}/jobs/${job.id}/segments.json`;

      await putObject({
        key: segmentJsonPath,
        body: Buffer.from(JSON.stringify({ segments }, null, 2), "utf8"),
        contentType: "application/json",
      });

      return {
        segmentJsonPath,
        segmentCount: segments.length,
        preview: segments.slice(0, 5),
      };
    } catch (error) {
      if (error instanceof SegmentStageError) {
        throw error;
      }

      throw new SegmentStageError(
        "segment_stage_failed",
        error instanceof Error ? error.message : "Unknown segment stage error",
      );
    }
  }
}

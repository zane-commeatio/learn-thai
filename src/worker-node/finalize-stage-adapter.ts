import { getObjectBuffer, putObject } from "../../lib/storage";
import { EditorPayloadSchema, type EditorPayload } from "../contracts/editor-payload";
import type { ProcessingJobRecord } from "../domain/repositories/processing-jobs-repository";
import type { FinalizeStageAdapter, FinalizeStageArtifactRefs } from "../worker/stages/finalize";

type SegmentPayload = {
  segments?: unknown;
};

type TranslationPayload = {
  translations?: unknown;
};

type RawSegmentRecord = {
  index?: unknown;
  text?: unknown;
  startMs?: unknown;
  endMs?: unknown;
};

type RawTranslationRecord = {
  segmentIndex?: unknown;
  englishText?: unknown;
};

type ParsedSegment = {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSegmentPayload(buffer: Buffer): SegmentPayload {
  const payload = JSON.parse(buffer.toString("utf8")) as unknown;
  if (!payload || typeof payload !== "object") {
    throw new FinalizeStageError("finalize_invalid_segment_payload", "Segment payload is invalid");
  }

  return payload as SegmentPayload;
}

function parseTranslationPayload(buffer: Buffer): TranslationPayload {
  const payload = JSON.parse(buffer.toString("utf8")) as unknown;
  if (!payload || typeof payload !== "object") {
    throw new FinalizeStageError("finalize_invalid_translation_payload", "Translation payload is invalid");
  }

  return payload as TranslationPayload;
}

function extractSegments(payload: SegmentPayload): ParsedSegment[] {
  if (!Array.isArray(payload.segments)) {
    throw new FinalizeStageError("finalize_invalid_segment_payload", "Segment payload missing segments array");
  }

  const segments: ParsedSegment[] = [];
  for (const item of payload.segments) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as RawSegmentRecord;
    const text = asString(record.text);
    if (!text) {
      continue;
    }

    segments.push({
      index: asNumber(record.index) ?? segments.length,
      text,
      startMs: asNumber(record.startMs),
      endMs: asNumber(record.endMs),
    });
  }

  if (segments.length === 0) {
    throw new FinalizeStageError("finalize_invalid_segment_payload", "Segment payload has no usable segments");
  }

  return segments;
}

function extractTranslations(payload: TranslationPayload): Map<number, string> {
  if (!Array.isArray(payload.translations)) {
    throw new FinalizeStageError(
      "finalize_invalid_translation_payload",
      "Translation payload missing translations array",
    );
  }

  const translations = new Map<number, string>();
  for (const item of payload.translations) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as RawTranslationRecord;
    const segmentIndex = asNumber(record.segmentIndex);
    const englishText = asString(record.englishText);
    if (segmentIndex === null || !englishText) {
      continue;
    }

    if (translations.has(segmentIndex)) {
      throw new FinalizeStageError(
        "finalize_invalid_translation_payload",
        `Duplicate translation for segment ${segmentIndex}`,
      );
    }

    translations.set(segmentIndex, englishText);
  }

  if (translations.size === 0) {
    throw new FinalizeStageError(
      "finalize_invalid_translation_payload",
      "Translation payload has no usable translations",
    );
  }

  return translations;
}

function buildEditorPayload(job: ProcessingJobRecord, input: {
  normalizedVideoPath: string | null;
  audioWavPath: string | null;
  posterImagePath: string | null;
}, segments: ParsedSegment[], translations: Map<number, string>): EditorPayload {
  const timestamp = new Date().toISOString();

  const payload: EditorPayload = {
    clipId: job.clipId,
    sourceJobId: job.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    media: {
      normalizedVideoPath: input.normalizedVideoPath,
      audioWavPath: input.audioWavPath,
      posterImagePath: input.posterImagePath,
    },
    thumbnail: {
      imagePath: input.posterImagePath,
      source: "generated",
    },
    segments: segments.map((segment) => {
      const englishText = translations.get(segment.index);
      if (!englishText) {
        throw new FinalizeStageError(
          "finalize_translation_mismatch",
          `Missing translation for segment ${segment.index}`,
        );
      }

      return {
        index: segment.index,
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
        translation: {
          englishText,
          source: "generated",
        },
      };
    }),
    review: {
      status: "generated",
      hasManualChanges: false,
    },
  };

  return EditorPayloadSchema.parse(payload);
}

function buildEditedPayload(payload: EditorPayload): EditorPayload {
  return {
    ...payload,
    review: {
      status: "edited",
      hasManualChanges: false,
    },
  };
}

export class FinalizeStageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NodeFinalizeStageAdapter implements FinalizeStageAdapter {
  async run(job: ProcessingJobRecord, input: {
    segmentJsonPath: string;
    translationJsonPath: string;
    normalizedVideoPath: string | null;
    audioWavPath: string | null;
    posterImagePath: string | null;
  }): Promise<FinalizeStageArtifactRefs> {
    const [segmentBuffer, translationBuffer] = await Promise.all([
      getObjectBuffer(input.segmentJsonPath),
      getObjectBuffer(input.translationJsonPath),
    ]);

    if (!segmentBuffer) {
      throw new FinalizeStageError("finalize_input_missing", `Missing segment artifact: ${input.segmentJsonPath}`);
    }
    if (!translationBuffer) {
      throw new FinalizeStageError(
        "finalize_input_missing",
        `Missing translation artifact: ${input.translationJsonPath}`,
      );
    }

    try {
      const segments = extractSegments(parseSegmentPayload(segmentBuffer));
      const translations = extractTranslations(parseTranslationPayload(translationBuffer));
      const generatedPayload = buildEditorPayload(job, input, segments, translations);
      const editedPayload = buildEditedPayload(generatedPayload);

      const generatedPayloadPath = `clips/${job.clipId}/jobs/${job.id}/generated-payload.json`;
      const editedPayloadPath = `clips/${job.clipId}/jobs/${job.id}/edited-payload.json`;

      await Promise.all([
        putObject({
          key: generatedPayloadPath,
          body: Buffer.from(JSON.stringify(generatedPayload, null, 2), "utf8"),
          contentType: "application/json",
        }),
        putObject({
          key: editedPayloadPath,
          body: Buffer.from(JSON.stringify(editedPayload, null, 2), "utf8"),
          contentType: "application/json",
        }),
      ]);

      return {
        generatedPayloadPath,
        editedPayloadPath,
        segmentCount: generatedPayload.segments.length,
        translationCount: generatedPayload.segments.length,
        thumbnailPath: generatedPayload.thumbnail.imagePath,
      };
    } catch (error) {
      if (error instanceof FinalizeStageError) {
        throw error;
      }

      throw new FinalizeStageError(
        "finalize_stage_failed",
        error instanceof Error ? error.message : "Unknown finalize stage error",
      );
    }
  }
}

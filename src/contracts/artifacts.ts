export type SegmentPreview = {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
};

export type TranslationPreview = {
  segmentIndex: number;
  sourceText: string;
  englishText: string;
};

export type ProcessingJobArtifactRefs = {
  normalizedVideoPath: string | null;
  posterImagePath: string | null;
  audioWavPath: string | null;
  asr: {
    asrJsonPath: string | null;
    transcriptPreview: string | null;
    segmentCount: number | null;
    wordCount: number | null;
    language: string | null;
  };
  segment: {
    segmentJsonPath: string | null;
    segmentCount: number | null;
    preview: SegmentPreview[];
  };
  translate: {
    translationJsonPath: string | null;
    translationCount: number | null;
    preview: TranslationPreview[];
  };
  finalize: {
    generatedPayloadPath: string | null;
    editedPayloadPath: string | null;
    segmentCount: number | null;
    translationCount: number | null;
    thumbnailPath: string | null;
  };
};

export const EMPTY_PROCESSING_JOB_ARTIFACT_REFS: ProcessingJobArtifactRefs = {
  normalizedVideoPath: null,
  posterImagePath: null,
  audioWavPath: null,
  asr: {
    asrJsonPath: null,
    transcriptPreview: null,
    segmentCount: null,
    wordCount: null,
    language: null,
  },
  segment: {
    segmentJsonPath: null,
    segmentCount: null,
    preview: [],
  },
  translate: {
    translationJsonPath: null,
    translationCount: null,
    preview: [],
  },
  finalize: {
    generatedPayloadPath: null,
    editedPayloadPath: null,
    segmentCount: null,
    translationCount: null,
    thumbnailPath: null,
  },
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

export function parseProcessingJobArtifactRefs(value: unknown): ProcessingJobArtifactRefs {
  const raw = asObject(value);
  if (!raw) {
    return EMPTY_PROCESSING_JOB_ARTIFACT_REFS;
  }

  const parsedAsr = asObject(raw.asr);
  const parsedSegment = asObject(raw.segment);
  const parsedTranslate = asObject(raw.translate);
  const parsedFinalize = asObject(raw.finalize);

  const segmentPreview = Array.isArray(parsedSegment?.preview)
    ? parsedSegment.preview
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        index: asNumber(item.index) ?? 0,
        text: asString(item.text) ?? "",
        startMs: asNumber(item.startMs),
        endMs: asNumber(item.endMs),
      }))
      .filter((item) => item.text.length > 0)
    : [];

  const translationPreview = Array.isArray(parsedTranslate?.preview)
    ? parsedTranslate.preview
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        segmentIndex: asNumber(item.segmentIndex) ?? 0,
        sourceText: asString(item.sourceText) ?? "",
        englishText: asString(item.englishText) ?? "",
      }))
      .filter((item) => item.sourceText.length > 0 && item.englishText.length > 0)
    : [];

  return {
    normalizedVideoPath: asString(raw.normalizedVideoPath),
    posterImagePath: asString(raw.posterImagePath),
    audioWavPath: asString(raw.audioWavPath),
    asr: {
      asrJsonPath: asString(parsedAsr?.asrJsonPath),
      transcriptPreview: asString(parsedAsr?.transcriptPreview),
      segmentCount: asNumber(parsedAsr?.segmentCount),
      wordCount: asNumber(parsedAsr?.wordCount),
      language: asString(parsedAsr?.language),
    },
    segment: {
      segmentJsonPath: asString(parsedSegment?.segmentJsonPath),
      segmentCount: asNumber(parsedSegment?.segmentCount),
      preview: segmentPreview,
    },
    translate: {
      translationJsonPath: asString(parsedTranslate?.translationJsonPath),
      translationCount: asNumber(parsedTranslate?.translationCount),
      preview: translationPreview,
    },
    finalize: {
      generatedPayloadPath: asString(parsedFinalize?.generatedPayloadPath),
      editedPayloadPath: asString(parsedFinalize?.editedPayloadPath),
      segmentCount: asNumber(parsedFinalize?.segmentCount),
      translationCount: asNumber(parsedFinalize?.translationCount),
      thumbnailPath: asString(parsedFinalize?.thumbnailPath),
    },
  };
}

export function getNormalizedVideoPath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).normalizedVideoPath;
}

export function getPosterImagePath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).posterImagePath;
}

export function getAudioWavPath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).audioWavPath;
}

export function getAsrJsonPath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).asr.asrJsonPath;
}

export function getSegmentJsonPath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).segment.segmentJsonPath;
}

export function getTranslationJsonPath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).translate.translationJsonPath;
}

export function getGeneratedPayloadPath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).finalize.generatedPayloadPath;
}

export function getEditedPayloadPath(value: unknown): string | null {
  return parseProcessingJobArtifactRefs(value).finalize.editedPayloadPath;
}

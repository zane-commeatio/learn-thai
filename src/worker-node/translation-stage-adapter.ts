import { OpenRouter } from "@openrouter/sdk";
import { pipeline } from "@huggingface/transformers";
import { OpenRouterError } from "@openrouter/sdk/models/errors";
import type { ProcessingJobRecord } from "../domain/repositories/processing-jobs-repository";
import { getObjectBuffer, putObject } from "../../lib/storage";
import type {
  SegmentTranslation,
  TranslationStageAdapter,
  TranslationStageArtifactRefs,
} from "../worker/stages/translation";

type SegmentInputRecord = {
  index?: unknown;
  text?: unknown;
};

type SegmentPayload = {
  segments?: unknown;
};

type TranslationOutputRecord = {
  translations: SegmentTranslation[];
};

type TranslationPipelineResult = Array<{
  translation_text?: string;
}>;

type TranslationPipelineInstance = (text: string, options: {
  src_lang: string;
  tgt_lang: string;
}) => Promise<TranslationPipelineResult>;

type TranslationSchemaResult = {
  translations?: Array<{
    segmentIndex?: unknown;
    englishText?: unknown;
  }>;
};

type OrderedSegment = {
  index: number;
  text: string;
};

type TranslationBackend = {
  translateSegments(segments: OrderedSegment[]): Promise<Array<{ segmentIndex: number; englishText: string }>>;
};

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterResponseLike = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

const LOCAL_MODEL_ID = "Xenova/nllb-200-distilled-600M";
const LOCAL_SOURCE_LANG = "tha_Thai";
const LOCAL_TARGET_LANG = "eng_Latn";
const DEFAULT_OPENROUTER_MODEL = "stepfun/step-3.5-flash:free";

let translatorPromise: Promise<TranslationPipelineInstance> | null = null;

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseSegmentPayload(buffer: Buffer): SegmentPayload {
  const payload = JSON.parse(buffer.toString("utf8")) as unknown;
  if (!payload || typeof payload !== "object") {
    throw new TranslationStageError("translate_invalid_segment_payload", "Segment payload is invalid");
  }

  return payload as SegmentPayload;
}

function extractSegments(payload: SegmentPayload): OrderedSegment[] {
  if (!Array.isArray(payload.segments)) {
    throw new TranslationStageError(
      "translate_invalid_segment_payload",
      "Segment payload missing segments array",
    );
  }

  const segments: OrderedSegment[] = [];
  for (const item of payload.segments) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as SegmentInputRecord;
    const text = asString(record.text);
    if (!text) {
      continue;
    }

    const index = typeof record.index === "number" && Number.isFinite(record.index)
      ? record.index
      : segments.length;
    segments.push({ index, text });
  }

  if (segments.length === 0) {
    throw new TranslationStageError(
      "translate_invalid_segment_payload",
      "Segment payload has no usable segments",
    );
  }

  return segments;
}

function buildTranslations(segments: OrderedSegment[], translated: Array<{ segmentIndex: number; englishText: string }>): SegmentTranslation[] {
  if (translated.length !== segments.length) {
    throw new TranslationStageError(
      "translation_provider_error",
      `Translation coverage mismatch: expected ${segments.length}, received ${translated.length}`,
    );
  }

  const translatedByIndex = new Map<number, string>();
  for (const item of translated) {
    if (translatedByIndex.has(item.segmentIndex)) {
      throw new TranslationStageError(
        "translation_provider_error",
        `Duplicate translation for segment ${item.segmentIndex}`,
      );
    }

    translatedByIndex.set(item.segmentIndex, item.englishText);
  }

  return segments.map((segment) => {
    const englishText = translatedByIndex.get(segment.index);
    if (!englishText) {
      throw new TranslationStageError(
        "translation_provider_error",
        `Missing translation for segment ${segment.index}`,
      );
    }

    return {
      segmentIndex: segment.index,
      sourceText: segment.text,
      englishText,
    };
  });
}

async function getLocalTranslator(): Promise<TranslationPipelineInstance> {
  translatorPromise ??= (async () => {
    const translator = await pipeline("translation", LOCAL_MODEL_ID);
    return translator as unknown as TranslationPipelineInstance;
  })();

  return translatorPromise;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new TranslationStageError(
      "translation_provider_missing",
      `${name} is required for the translate stage`,
    );
  }

  return value;
}

function getOpenRouterModel(): string {
  return process.env.OPENROUTER_TRANSLATION_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

function getSegmentCharacterCount(segments: OrderedSegment[]): number {
  return segments.reduce((total, segment) => total + segment.text.length, 0);
}

function summarizeText(value: string, maxLength = 280): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function logTranslateEvent(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({
    event,
    stage: "translate",
    ...details,
  }));
}

function logTranslateError(event: string, details: Record<string, unknown>) {
  console.error(JSON.stringify({
    event,
    stage: "translate",
    ...details,
  }));
}

function buildOpenRouterMessages(segments: OrderedSegment[]): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: [
        "You translate Thai subtitle/dialogue segments into natural English.",
        "Preserve meaning, tone, implied subjects, and politeness where natural in English.",
        "Do not merge or split segments.",
        "Return exactly one translation per segment index.",
        "Keep the English concise and subtitle-friendly.",
        "Return only a valid JSON object.",
        "The JSON object must have exactly one top-level field named translations.",
        "translations must be an array of objects with segmentIndex and englishText.",
        "Do not wrap the JSON in markdown fences.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Translate all Thai segments into natural English.",
        outputFormat: {
          translations: [
            {
              segmentIndex: 0,
              englishText: "Natural English translation for segment 0",
            },
          ],
        },
        segments,
      }),
    },
  ];
}

function buildOpenRouterResponseFormat() {
  return {
    type: "json_object" as const,
  };
}

function parseOpenRouterContent(content: unknown): TranslationSchemaResult {
  if (typeof content !== "string") {
    throw new TranslationStageError(
      "translation_provider_error",
      "OpenRouter returned non-text content",
    );
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Structured output was not an object");
    }

    return parsed as TranslationSchemaResult;
  } catch (error) {
    throw new TranslationStageError(
      "translation_provider_error",
      error instanceof Error ? `OpenRouter returned invalid JSON: ${error.message}` : "OpenRouter returned invalid JSON",
    );
  }
}

function validateOpenRouterTranslations(result: TranslationSchemaResult): Array<{ segmentIndex: number; englishText: string }> {
  if (!Array.isArray(result.translations)) {
    throw new TranslationStageError(
      "translation_provider_error",
      "OpenRouter response missing translations array",
    );
  }

  return result.translations.map((item) => {
    const record = asObject(item);
    const segmentIndex = record && typeof record.segmentIndex === "number" && Number.isFinite(record.segmentIndex)
      ? record.segmentIndex
      : null;
    const englishText = asString(record?.englishText);

    if (segmentIndex === null) {
      throw new TranslationStageError(
        "translation_provider_error",
        "OpenRouter response contained a translation without a numeric segmentIndex",
      );
    }

    if (!englishText) {
      throw new TranslationStageError(
        "translation_provider_error",
        `OpenRouter response contained an empty translation for segment ${segmentIndex}`,
      );
    }

    return { segmentIndex, englishText };
  });
}

export class TranslationStageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class LocalNllbTranslationBackend implements TranslationBackend {
  async translateSegments(segments: OrderedSegment[]): Promise<Array<{ segmentIndex: number; englishText: string }>> {
    const translator = await getLocalTranslator();
    const translations: Array<{ segmentIndex: number; englishText: string }> = [];

    for (const segment of segments) {
      const payload = await translator(segment.text, {
        src_lang: LOCAL_SOURCE_LANG,
        tgt_lang: LOCAL_TARGET_LANG,
      });
      const englishText = asString(payload[0]?.translation_text);
      if (!englishText) {
        throw new TranslationStageError(
          "translation_provider_error",
          `Translation model returned no translation text for segment ${segment.index}`,
        );
      }

      translations.push({ segmentIndex: segment.index, englishText });
    }

    return translations;
  }
}

export class OpenRouterTranslationBackend implements TranslationBackend {
  async translateSegments(segments: OrderedSegment[]): Promise<Array<{ segmentIndex: number; englishText: string }>> {
    const model = getOpenRouterModel();
    const segmentCount = segments.length;
    const characterCount = getSegmentCharacterCount(segments);
    const client = new OpenRouter({
      apiKey: getRequiredEnv("OPENROUTER_API_KEY"),
    });

    logTranslateEvent("translate_openrouter_request_started", {
      provider: "openrouter",
      model,
      segmentCount,
      characterCount,
      firstSegmentPreview: summarizeText(segments[0]?.text ?? ""),
      lastSegmentPreview: summarizeText(segments[segments.length - 1]?.text ?? ""),
    });

    let response: OpenRouterResponseLike;
    try {
      response = await client.chat.send({
        chatGenerationParams: {
          model,
          messages: buildOpenRouterMessages(segments),
          responseFormat: buildOpenRouterResponseFormat(),
          temperature: 0,
        },
      }) as OpenRouterResponseLike;
    } catch (error) {
      if (error instanceof OpenRouterError) {
        logTranslateError("translate_openrouter_request_failed", {
          provider: "openrouter",
          model,
          statusCode: error.statusCode,
          message: error.message,
          bodyPreview: summarizeText(error.body, 500),
        });

        throw new TranslationStageError(
          "translation_provider_error",
          `OpenRouter ${error.statusCode}: ${error.message}${error.body ? ` | ${summarizeText(error.body, 220)}` : ""}`,
        );
      }

      logTranslateError("translate_openrouter_request_failed", {
        provider: "openrouter",
        model,
        message: error instanceof Error ? error.message : "OpenRouter request failed",
      });

      throw new TranslationStageError(
        "translation_provider_error",
        error instanceof Error ? error.message : "OpenRouter request failed",
      );
    }

    const content = response.choices?.[0]?.message?.content;
    logTranslateEvent("translate_openrouter_response_received", {
      provider: "openrouter",
      model: response.model ?? model,
      responseId: response.id ?? null,
      contentType: typeof content,
      contentPreview: typeof content === "string" ? summarizeText(content, 500) : null,
    });
    const parsed = parseOpenRouterContent(content);
    const validated = validateOpenRouterTranslations(parsed);
    logTranslateEvent("translate_openrouter_response_validated", {
      provider: "openrouter",
      model: response.model ?? model,
      translationCount: validated.length,
    });
    return validated;
  }
}

export class NodeTranslationStageAdapter implements TranslationStageAdapter {
  constructor(
    private readonly backend: TranslationBackend = new OpenRouterTranslationBackend(),
  ) {}

  async run(job: ProcessingJobRecord, input: { segmentJsonPath: string }): Promise<TranslationStageArtifactRefs> {
    const segmentBuffer = await getObjectBuffer(input.segmentJsonPath);
    if (!segmentBuffer) {
      throw new TranslationStageError(
        "translate_input_missing",
        `Missing segment artifact: ${input.segmentJsonPath}`,
      );
    }

    try {
      const payload = parseSegmentPayload(segmentBuffer);
      const segments = extractSegments(payload);
      logTranslateEvent("translate_stage_started", {
        jobId: job.id,
        clipId: job.clipId,
        segmentJsonPath: input.segmentJsonPath,
        segmentCount: segments.length,
        characterCount: getSegmentCharacterCount(segments),
      });
      const translated = await this.backend.translateSegments(segments);
      const translations = buildTranslations(segments, translated);

      const translationJsonPath = `clips/${job.clipId}/jobs/${job.id}/translations.json`;
      const output: TranslationOutputRecord = { translations };

      await putObject({
        key: translationJsonPath,
        body: Buffer.from(JSON.stringify(output, null, 2), "utf8"),
        contentType: "application/json",
      });

      logTranslateEvent("translate_stage_completed", {
        jobId: job.id,
        clipId: job.clipId,
        translationJsonPath,
        translationCount: translations.length,
      });

      return {
        translationJsonPath,
        translationCount: translations.length,
        preview: translations.slice(0, 5),
      };
    } catch (error) {
      if (error instanceof TranslationStageError) {
        logTranslateError("translate_stage_failed", {
          jobId: job.id,
          clipId: job.clipId,
          code: error.code,
          message: error.message,
        });
        throw error;
      }

      logTranslateError("translate_stage_failed", {
        jobId: job.id,
        clipId: job.clipId,
        code: "translate_stage_failed",
        message: error instanceof Error ? error.message : "Unknown translate stage error",
      });

      throw new TranslationStageError(
        "translate_stage_failed",
        error instanceof Error ? error.message : "Unknown translate stage error",
      );
    }
  }
}

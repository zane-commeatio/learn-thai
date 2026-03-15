import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodewhisper } from "nodejs-whisper";
import type { ProcessingJobRecord } from "../domain/repositories/processing-jobs-repository";
import type {
  AsrStageArtifactRefs,
  AsrTranscriptionStageAdapter,
} from "../worker/stages/asr-transcription";
import { getObjectBuffer, putObject } from "../../lib/storage";

type WhisperSegment = {
  text?: unknown;
  start?: unknown;
  end?: unknown;
  words?: unknown;
  offsets?: {
    from?: unknown;
    to?: unknown;
  } | unknown;
  timestamps?: {
    from?: unknown;
    to?: unknown;
  } | unknown;
};

type WhisperWord = {
  word?: unknown;
  start?: unknown;
  end?: unknown;
};

type WhisperJsonOutput = {
  text?: unknown;
  result?: unknown;
  language?: unknown;
  segments?: unknown;
  transcription?: unknown;
};

type NormalizedWord = {
  word: string;
  start: number | null;
  end: number | null;
};

type NormalizedSegment = {
  text: string;
  start: number | null;
  end: number | null;
  words: NormalizedWord[];
};

type NormalizedAsrOutput = {
  text: string;
  language: string | null;
  segments: NormalizedSegment[];
};

const DEFAULT_WHISPER_MODEL = "small";

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  return raw === "1" || raw.toLowerCase() === "true";
}

function normalizeTranscript(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim();
}

function toTranscriptPreview(text: string): string {
  const normalized = normalizeTranscript(text);
  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
}

function parseWhisperJson(raw: string): WhisperJsonOutput | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as WhisperJsonOutput;
  } catch {
    return null;
  }
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function parseTimestampToSeconds(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!match) {
    return null;
  }

  const [, h, m, s, ms] = match;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  const millis = Number(ms);
  if ([hours, minutes, seconds, millis].some((n) => Number.isNaN(n))) {
    return null;
  }

  return (hours * 3600) + (minutes * 60) + seconds + (millis / 1000);
}

function normalizeWords(words: unknown): NormalizedWord[] {
  if (!Array.isArray(words)) {
    return [];
  }

  const normalized: NormalizedWord[] = [];
  for (const item of words) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const word = (item as WhisperWord).word;
    if (typeof word !== "string" || word.trim().length === 0) {
      continue;
    }

    normalized.push({
      word: word.trim(),
      start: asFiniteNumber((item as WhisperWord).start),
      end: asFiniteNumber((item as WhisperWord).end),
    });
  }

  return normalized;
}

function normalizeFromStandardSegments(payload: WhisperJsonOutput): NormalizedSegment[] {
  if (!Array.isArray(payload.segments)) {
    return [];
  }

  const normalized: NormalizedSegment[] = [];
  for (const item of payload.segments) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const segment = item as WhisperSegment;
    if (typeof segment.text !== "string" || segment.text.trim().length === 0) {
      continue;
    }

    normalized.push({
      text: segment.text.trim(),
      start: asFiniteNumber(segment.start),
      end: asFiniteNumber(segment.end),
      words: normalizeWords(segment.words),
    });
  }

  return normalized;
}

function normalizeFromTranscription(payload: WhisperJsonOutput): NormalizedSegment[] {
  if (!Array.isArray(payload.transcription)) {
    return [];
  }

  const normalized: NormalizedSegment[] = [];
  for (const item of payload.transcription) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const segment = item as WhisperSegment;
    if (typeof segment.text !== "string" || segment.text.trim().length === 0) {
      continue;
    }

    const offsets = segment.offsets && typeof segment.offsets === "object"
      ? segment.offsets as { from?: unknown; to?: unknown }
      : null;
    const timestamps = segment.timestamps && typeof segment.timestamps === "object"
      ? segment.timestamps as { from?: unknown; to?: unknown }
      : null;

    const fromOffset = asFiniteNumber(offsets?.from);
    const toOffset = asFiniteNumber(offsets?.to);
    const start = fromOffset !== null ? fromOffset / 1000 : parseTimestampToSeconds(timestamps?.from);
    const end = toOffset !== null ? toOffset / 1000 : parseTimestampToSeconds(timestamps?.to);

    normalized.push({
      text: segment.text.trim(),
      start,
      end,
      words: [],
    });
  }

  return normalized;
}

function normalizeAsrOutput(payload: WhisperJsonOutput | null, fallback: string): NormalizedAsrOutput {
  const standardSegments = payload ? normalizeFromStandardSegments(payload) : [];
  const segments = standardSegments.length > 0
    ? standardSegments
    : payload ? normalizeFromTranscription(payload) : [];

  const transcriptFromSegments = segments.map((segment) => segment.text).join(" ").trim();
  const transcriptFromPayload = payload && typeof payload.text === "string" && payload.text.trim().length > 0
    ? payload.text
    : payload && typeof payload.result === "string" && payload.result.trim().length > 0
      ? payload.result
      : null;
  const transcript = transcriptFromPayload ?? (transcriptFromSegments || fallback);
  const language = payload && typeof payload.language === "string" && payload.language.trim().length > 0
    ? payload.language
    : null;

  return {
    text: transcript,
    language,
    segments,
  };
}

function hasUsableSegments(output: NormalizedAsrOutput): boolean {
  return output.segments.some((segment) => segment.text.length > 0);
}

function toArtifactSegments(output: NormalizedAsrOutput): Array<{
  text: string;
  start: number | null;
  end: number | null;
  words: NormalizedWord[];
}> {
  return output.segments.map((segment) => ({
    text: segment.text,
    start: segment.start,
    end: segment.end,
    words: segment.words,
  }));
}

function extractWordCount(output: NormalizedAsrOutput): number {
  let count = 0;
  for (const segment of output.segments) {
    if (segment.words.length > 0) {
      count += segment.words.length;
      continue;
    }

    count += segment.text.split(/\s+/).filter(Boolean).length;
  }

  return count;
}

async function readGeneratedAsrJson(workdir: string, beforeRunFiles: Set<string>): Promise<string | null> {
  const files = await readdir(workdir);
  const generatedJsonFiles = files
    .filter((name) => name.endsWith(".json") && !beforeRunFiles.has(name))
    .sort();

  const firstFile = generatedJsonFiles[0];
  if (!firstFile) {
    return null;
  }

  return readFile(join(workdir, firstFile), "utf8");
}

export class AsrStageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NodeAsrTranscriptionStageAdapter implements AsrTranscriptionStageAdapter {
  async run(job: ProcessingJobRecord, input: { audioWavPath: string }): Promise<AsrStageArtifactRefs> {
    const wavBytes = await getObjectBuffer(input.audioWavPath);
    if (!wavBytes) {
      throw new AsrStageError("asr_audio_missing", `Missing audio artifact: ${input.audioWavPath}`);
    }

    const workdir = await mkdtemp(join(tmpdir(), `learn-thai-asr-${job.id}-`));
    const audioPath = join(workdir, "audio.wav");
    const modelName = process.env.WHISPER_MODEL_NAME?.trim() || DEFAULT_WHISPER_MODEL;
    const autoDownloadModel = parseBooleanEnv("WHISPER_AUTO_DOWNLOAD", false);

    try {
      await writeFile(audioPath, wavBytes);

      const beforeRunFiles = new Set(await readdir(workdir));
      const stdoutTranscript = await nodewhisper(audioPath, {
        modelName,
        autoDownloadModelName: autoDownloadModel ? modelName : undefined,
        withCuda: false,
        removeWavFileAfterTranscription: false,
        logger: console,
        whisperOptions: {
          outputInJsonFull: true,
          wordTimestamps: parseBooleanEnv("WHISPER_WORD_TIMESTAMPS", true),
          splitOnWord: true,
        },
      });

      const generatedJson = await readGeneratedAsrJson(workdir, beforeRunFiles);
      const parsedOutput = generatedJson ? parseWhisperJson(generatedJson) : null;
      const normalizedOutput = normalizeAsrOutput(parsedOutput, stdoutTranscript);
      if (!hasUsableSegments(normalizedOutput)) {
        throw new AsrStageError("asr_invalid_output", "ASR output missing raw.segments");
      }

      const transcript = normalizedOutput.text;
      if (!normalizeTranscript(transcript)) {
        throw new AsrStageError("asr_invalid_output", "ASR returned an empty transcript");
      }

      const artifactPayload = {
        transcript,
        raw: {
          language: normalizedOutput.language,
          segments: toArtifactSegments(normalizedOutput),
        },
        providerRaw: parsedOutput,
      };
      const asrJsonPath = `clips/${job.clipId}/jobs/${job.id}/asr.json`;

      await putObject({
        key: asrJsonPath,
        body: Buffer.from(JSON.stringify(artifactPayload, null, 2), "utf8"),
        contentType: "application/json",
      });

      return {
        asrJsonPath,
        transcriptPreview: toTranscriptPreview(transcript),
        segmentCount: normalizedOutput.segments.length,
        wordCount: extractWordCount(normalizedOutput),
        language: normalizedOutput.language,
      };
    } catch (error) {
      if (error instanceof AsrStageError) {
        throw error;
      }

      throw new AsrStageError(
        "asr_execution_failed",
        error instanceof Error ? error.message : "Unknown ASR execution error",
      );
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  }
}

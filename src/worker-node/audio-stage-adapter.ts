import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import type { ProcessingJobRecord } from "../domain/repositories/processing-jobs-repository";
import type {
  AudioNormalizationStageAdapter,
  AudioStageArtifactRefs,
} from "../worker/stages/audio-normalization";
import { getObjectBuffer, putObject } from "../../lib/storage";

const execFileAsync = promisify(execFile);

export class AudioStageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync("ffmpeg", args);
  } catch (error) {
    throw new AudioStageError(
      "audio_transcode_failed",
      error instanceof Error ? error.message : "ffmpeg execution failed",
    );
  }
}

export class NodeAudioNormalizationStageAdapter implements AudioNormalizationStageAdapter {
  async run(job: ProcessingJobRecord): Promise<AudioStageArtifactRefs> {
    const sourceKey = `clips/${job.clipId}/source`;
    const sourceBytes = await getObjectBuffer(sourceKey);
    if (!sourceBytes) {
      throw new AudioStageError("source_media_missing", `Missing uploaded source object: ${sourceKey}`);
    }

    const workdir = await mkdtemp(join(tmpdir(), `learn-thai-${job.id}-`));
    const sourcePath = join(workdir, "source-media");
    const normalizedPath = join(workdir, "normalized.mp4");
    const posterPath = join(workdir, "poster.jpg");
    const audioPath = join(workdir, "audio.wav");

    try {
      await writeFile(sourcePath, sourceBytes);

      await runFfmpeg([
        "-y",
        "-i",
        sourcePath,
        "-vf",
        "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        normalizedPath,
      ]);

      await runFfmpeg([
        "-y",
        "-i",
        normalizedPath,
        "-frames:v",
        "1",
        posterPath,
      ]);

      await runFfmpeg([
        "-y",
        "-i",
        normalizedPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        audioPath,
      ]);

      const artifactRefs: AudioStageArtifactRefs = {
        normalizedVideoPath: `clips/${job.clipId}/jobs/${job.id}/normalized.mp4`,
        posterImagePath: `clips/${job.clipId}/jobs/${job.id}/poster.jpg`,
        audioWavPath: `clips/${job.clipId}/jobs/${job.id}/audio.wav`,
      };

      await Promise.all([
        putObject({
          key: artifactRefs.normalizedVideoPath,
          body: await readFile(normalizedPath),
          contentType: "video/mp4",
        }),
        putObject({
          key: artifactRefs.posterImagePath,
          body: await readFile(posterPath),
          contentType: "image/jpeg",
        }),
        putObject({
          key: artifactRefs.audioWavPath,
          body: await readFile(audioPath),
          contentType: "audio/wav",
        }),
      ]);

      return artifactRefs;
    } catch (error) {
      if (error instanceof AudioStageError) {
        throw error;
      }

      throw new AudioStageError(
        "artifact_persist_failed",
        error instanceof Error ? error.message : "Failed to persist artifacts",
      );
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  }
}

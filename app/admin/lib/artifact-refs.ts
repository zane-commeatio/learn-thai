import {
  parseProcessingJobArtifactRefs,
  type ProcessingJobArtifactRefs,
} from "../../../src/contracts/artifacts";

export function parseAdminArtifactRefs(value: unknown): ProcessingJobArtifactRefs {
  return parseProcessingJobArtifactRefs(value);
}

export function getAdminArtifactUrls(jobId: string | null, artifactRefs: ProcessingJobArtifactRefs) {
  if (!jobId) {
    return {
      posterUrl: null,
      normalizedVideoUrl: null,
      wavUrl: null,
      asrUrl: null,
      segmentUrl: null,
      translateUrl: null,
      generatedPayloadUrl: null,
      editedPayloadUrl: null,
    };
  }

  return {
    posterUrl: artifactRefs.posterImagePath ? `/api/admin/jobs/${jobId}/artifacts/audio/poster` : null,
    normalizedVideoUrl: artifactRefs.normalizedVideoPath ? `/api/admin/jobs/${jobId}/artifacts/audio/normalized` : null,
    wavUrl: artifactRefs.audioWavPath ? `/api/admin/jobs/${jobId}/artifacts/audio/wav` : null,
    asrUrl: artifactRefs.asr.asrJsonPath ? `/api/admin/jobs/${jobId}/artifacts/asr` : null,
    segmentUrl: artifactRefs.segment.segmentJsonPath ? `/api/admin/jobs/${jobId}/artifacts/segment` : null,
    translateUrl: artifactRefs.translate.translationJsonPath ? `/api/admin/jobs/${jobId}/artifacts/translate` : null,
    generatedPayloadUrl: artifactRefs.finalize.generatedPayloadPath ? `/api/admin/jobs/${jobId}/artifacts/finalize/generated` : null,
    editedPayloadUrl: artifactRefs.finalize.editedPayloadPath ? `/api/admin/jobs/${jobId}/artifacts/finalize/edited` : null,
  };
}

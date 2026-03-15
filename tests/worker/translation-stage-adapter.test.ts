import { beforeEach, describe, expect, it, vi } from "vitest";

const getObjectBufferMock = vi.fn();
const putObjectMock = vi.fn();
const pipelineMock = vi.fn();
const openRouterSendMock = vi.fn();
const openRouterConstructorMock = vi.fn(() => ({
  chat: {
    send: openRouterSendMock,
  },
}));

vi.mock("../../lib/storage", () => ({
  getObjectBuffer: getObjectBufferMock,
  putObject: putObjectMock,
}));

vi.mock("@huggingface/transformers", () => ({
  pipeline: pipelineMock,
}));

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: openRouterConstructorMock,
}));

describe("NodeTranslationStageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_TRANSLATION_MODEL;
  });

  it("preserves the v1 local NLLB backend for rollback", async () => {
    getObjectBufferMock.mockResolvedValue(Buffer.from(JSON.stringify({
      segments: [
        { index: 0, text: "สวัสดีค่ะ" },
        { index: 1, text: "ขอบคุณมาก" },
      ],
    }), "utf8"));

    const translatorMock = vi.fn()
      .mockResolvedValueOnce([{ translation_text: "Hello." }])
      .mockResolvedValueOnce([{ translation_text: "Thank you very much." }]);
    pipelineMock.mockResolvedValue(translatorMock);

    const {
      LocalNllbTranslationBackend,
      NodeTranslationStageAdapter,
    } = await import("../../src/worker-node/translation-stage-adapter");
    const adapter = new NodeTranslationStageAdapter(new LocalNllbTranslationBackend());

    const result = await adapter.run(
      { id: "job_1", clipId: "clip_1", state: "processing", stage: "translate", errorPayload: null, artifactRefs: null, lockToken: null, lockExpiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      { segmentJsonPath: "clips/clip_1/jobs/job_1/segments.json" },
    );

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(pipelineMock).toHaveBeenCalledWith("translation", "Xenova/nllb-200-distilled-600M");
    expect(translatorMock).toHaveBeenNthCalledWith(1, "สวัสดีค่ะ", {
      src_lang: "tha_Thai",
      tgt_lang: "eng_Latn",
    });
    expect(translatorMock).toHaveBeenNthCalledWith(2, "ขอบคุณมาก", {
      src_lang: "tha_Thai",
      tgt_lang: "eng_Latn",
    });
    expect(result.preview).toEqual([
      { segmentIndex: 0, sourceText: "สวัสดีค่ะ", englishText: "Hello." },
      { segmentIndex: 1, sourceText: "ขอบคุณมาก", englishText: "Thank you very much." },
    ]);
  });

  it("translates the whole clip with OpenRouter structured outputs", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_TRANSLATION_MODEL = "stepfun/step-3.5-flash:free";

    getObjectBufferMock.mockResolvedValue(Buffer.from(JSON.stringify({
      segments: [
        { index: 0, text: "สวัสดีค่ะ" },
        { index: 1, text: "ขอบคุณมาก" },
      ],
    }), "utf8"));

    openRouterSendMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              translations: [
                { segmentIndex: 0, englishText: "Hello." },
                { segmentIndex: 1, englishText: "Thank you very much." },
              ],
            }),
          },
        },
      ],
    });

    const {
      NodeTranslationStageAdapter,
      OpenRouterTranslationBackend,
    } = await import("../../src/worker-node/translation-stage-adapter");
    const adapter = new NodeTranslationStageAdapter(new OpenRouterTranslationBackend());

    const result = await adapter.run(
      { id: "job_1", clipId: "clip_1", state: "processing", stage: "translate", errorPayload: null, artifactRefs: null, lockToken: null, lockExpiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      { segmentJsonPath: "clips/clip_1/jobs/job_1/segments.json" },
    );

    expect(openRouterConstructorMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(openRouterSendMock).toHaveBeenCalledTimes(1);
    expect(openRouterSendMock.mock.calls[0]?.[0]).toMatchObject({
      chatGenerationParams: {
        model: "stepfun/step-3.5-flash:free",
        responseFormat: {
          type: "json_object",
        },
        temperature: 0,
      },
    });
    expect(putObjectMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      translationJsonPath: "clips/clip_1/jobs/job_1/translations.json",
      translationCount: 2,
      preview: [
        { segmentIndex: 0, sourceText: "สวัสดีค่ะ", englishText: "Hello." },
        { segmentIndex: 1, sourceText: "ขอบคุณมาก", englishText: "Thank you very much." },
      ],
    });
  });

  it("fails when OpenRouter is not configured and translate runs", async () => {
    getObjectBufferMock.mockResolvedValue(Buffer.from(JSON.stringify({
      segments: [{ index: 0, text: "สวัสดีค่ะ" }],
    }), "utf8"));

    const {
      NodeTranslationStageAdapter,
      OpenRouterTranslationBackend,
    } = await import("../../src/worker-node/translation-stage-adapter");
    const adapter = new NodeTranslationStageAdapter(new OpenRouterTranslationBackend());

    await expect(adapter.run(
      { id: "job_1", clipId: "clip_1", state: "processing", stage: "translate", errorPayload: null, artifactRefs: null, lockToken: null, lockExpiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      { segmentJsonPath: "clips/clip_1/jobs/job_1/segments.json" },
    )).rejects.toMatchObject({
      code: "translation_provider_missing",
    });
  });

  it("fails when OpenRouter returns invalid coverage", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    getObjectBufferMock.mockResolvedValue(Buffer.from(JSON.stringify({
      segments: [
        { index: 0, text: "สวัสดีค่ะ" },
        { index: 1, text: "ขอบคุณมาก" },
      ],
    }), "utf8"));

    openRouterSendMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              translations: [
                { segmentIndex: 0, englishText: "Hello." },
              ],
            }),
          },
        },
      ],
    });

    const {
      NodeTranslationStageAdapter,
      OpenRouterTranslationBackend,
    } = await import("../../src/worker-node/translation-stage-adapter");
    const adapter = new NodeTranslationStageAdapter(new OpenRouterTranslationBackend());

    await expect(adapter.run(
      { id: "job_1", clipId: "clip_1", state: "processing", stage: "translate", errorPayload: null, artifactRefs: null, lockToken: null, lockExpiresAt: null, createdAt: new Date(), updatedAt: new Date() },
      { segmentJsonPath: "clips/clip_1/jobs/job_1/segments.json" },
    )).rejects.toMatchObject({
      code: "translation_provider_error",
    });
  });
});

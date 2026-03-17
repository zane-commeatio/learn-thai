import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSessionMock = vi.fn();
const readStoredJobArtifactMock = vi.fn();
const toArtifactResponseMock = vi.fn();

vi.mock("../../lib/admin-auth", () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock("../../app/api/admin/jobs/[jobId]/artifacts/_lib", () => ({
  readStoredJobArtifact: readStoredJobArtifactMock,
  toArtifactResponse: toArtifactResponseMock,
}));

describe("admin artifact routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 json when downloading artifacts without an admin session", async () => {
    getAdminSessionMock.mockResolvedValueOnce(null);

    const route = await import("../../app/api/admin/jobs/[jobId]/artifacts/asr/route");
    const response = await route.GET(new Request("https://example.com/api/admin/jobs/job_1/artifacts/asr"), {
      params: Promise.resolve({ jobId: "job_1" }),
    });
    const body = await response.json() as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({
      code: "unauthorized",
      message: "Admin session required",
    });
    expect(readStoredJobArtifactMock).not.toHaveBeenCalled();
  });

  it("returns the stored artifact response when the artifact exists", async () => {
    getAdminSessionMock.mockResolvedValueOnce({ role: "admin", email: "admin@example.com" });
    readStoredJobArtifactMock.mockResolvedValueOnce(Buffer.from("{}"));
    toArtifactResponseMock.mockReturnValueOnce(new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }));

    const route = await import("../../app/api/admin/jobs/[jobId]/artifacts/asr/route");
    const response = await route.GET(new Request("https://example.com/api/admin/jobs/job_1/artifacts/asr"), {
      params: Promise.resolve({ jobId: "job_1" }),
    });

    expect(response.status).toBe(200);
    expect(toArtifactResponseMock).toHaveBeenCalledOnce();
  });
});

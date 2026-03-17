import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSessionMock = vi.fn();
const listClipsMock = vi.fn();
const getJobMock = vi.fn();
const getDbMock = vi.fn();
const processingJobsRepositoryMock = vi.fn();

vi.mock("../../lib/admin-auth", () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock("../../src/admin/services/list-clips", () => ({
  listClips: listClipsMock,
}));

vi.mock("../../src/admin/services/get-job", () => ({
  getJob: getJobMock,
}));

vi.mock("../../lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("../../src/db/repositories/processing-jobs-repository", () => ({
  DrizzleProcessingJobsRepository: processingJobsRepositoryMock,
}));

describe("admin api routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getDbMock.mockReturnValue({});
    processingJobsRepositoryMock.mockImplementation(() => ({}));
  });

  it("returns 401 json when listing clips without an admin session", async () => {
    getAdminSessionMock.mockResolvedValueOnce(null);

    const route = await import("../../app/api/admin/clips/route");
    const response = await route.GET();
    const body = await response.json() as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({
      code: "unauthorized",
      message: "Admin session required",
    });
    expect(listClipsMock).not.toHaveBeenCalled();
  });

  it("preserves error details in the shared envelope for job lookups", async () => {
    getAdminSessionMock.mockResolvedValueOnce({ role: "admin", email: "admin@example.com" });
    const { AdminServiceError } = await import("../../src/admin/services/errors");
    getJobMock.mockRejectedValueOnce(
      new AdminServiceError(
        "conflict",
        "A processing job is already running for this clip",
        { activeJobId: "job_active" },
      ),
    );

    const route = await import("../../app/api/admin/jobs/[jobId]/route");
    const response = await route.GET(new Request("https://example.com/api/admin/jobs/job_1"), {
      params: Promise.resolve({ jobId: "job_1" }),
    });
    const body = await response.json() as {
      code: string;
      message: string;
      details?: { activeJobId: string };
    };

    expect(response.status).toBe(409);
    expect(body).toEqual({
      code: "conflict",
      message: "A processing job is already running for this clip",
      details: {
        activeJobId: "job_active",
      },
    });
  });
});

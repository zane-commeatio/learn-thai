import { describe, expect, it, vi } from "vitest";
import { listClips } from "../../src/admin/services/list-clips";

function createClipQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

function createJobQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

describe("listClips", () => {
  it("returns clips with the newest job attached per clip", async () => {
    const clipRows = [
      {
        id: "clip_2",
        title: "Second clip",
        ownerId: "owner_1",
        sourceType: "upload",
        rightsStatus: "owned",
        createdAt: new Date("2026-03-14T10:00:00.000Z"),
        updatedAt: new Date("2026-03-14T12:00:00.000Z"),
      },
      {
        id: "clip_1",
        title: "First clip",
        ownerId: "owner_1",
        sourceType: "upload",
        rightsStatus: "owned",
        createdAt: new Date("2026-03-14T09:00:00.000Z"),
        updatedAt: new Date("2026-03-14T11:00:00.000Z"),
      },
    ];
    const jobRows = [
      {
        id: "job_newest_clip_1",
        clipId: "clip_1",
        state: "processing",
        stage: "translate",
        updatedAt: new Date("2026-03-14T12:30:00.000Z"),
      },
      {
        id: "job_for_clip_2",
        clipId: "clip_2",
        state: "needs_review",
        stage: "finalize",
        updatedAt: new Date("2026-03-14T12:15:00.000Z"),
      },
      {
        id: "job_old_clip_1",
        clipId: "clip_1",
        state: "failed",
        stage: "audio",
        updatedAt: new Date("2026-03-14T11:30:00.000Z"),
      },
    ];

    const clipQuery = createClipQuery(clipRows);
    const jobQuery = createJobQuery(jobRows);
    const db = {
      select: vi.fn()
        .mockReturnValueOnce(clipQuery)
        .mockReturnValueOnce(jobQuery),
    };

    const result = await listClips({ db: db as never });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      clips: [
        {
          ...clipRows[0],
          latestJob: jobRows[1],
        },
        {
          ...clipRows[1],
          latestJob: jobRows[0],
        },
      ],
    });
  });

  it("returns an empty list without querying jobs when there are no clips", async () => {
    const clipQuery = createClipQuery([]);
    const db = {
      select: vi.fn().mockReturnValueOnce(clipQuery),
    };

    const result = await listClips({ db: db as never });

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ clips: [] });
  });
});

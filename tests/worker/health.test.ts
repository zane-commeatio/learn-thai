import { describe, expect, it } from "vitest";
import { handleRequest } from "../../src/worker/app";

describe("GET /api/mobile/health", () => {
  it("returns 200 with status and apiVersion from env", async () => {
    const request = new Request("https://example.com/api/mobile/health");
    const response = handleRequest(request, { API_VERSION: "v2" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", apiVersion: "v2" });
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("falls back to v1 when API_VERSION is unset", async () => {
    const request = new Request("https://example.com/api/mobile/health");
    const response = handleRequest(request, {});
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", apiVersion: "v1" });
  });

  it("returns 404 for non-existent route", async () => {
    const request = new Request("https://example.com/api/mobile/missing");
    const response = handleRequest(request, {});
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "not_found",
        message: "Not Found",
      },
    });
  });

  it("returns 404 for wrong method on health path", async () => {
    const request = new Request("https://example.com/api/mobile/health", {
      method: "POST",
    });
    const response = handleRequest(request, {});
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "not_found",
        message: "Not Found",
      },
    });
  });
});

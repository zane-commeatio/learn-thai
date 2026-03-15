import { describe, expect, it } from "vitest";
import {
  ApiErrorEnvelopeSchema,
  invalidRequest,
  jsonError,
} from "../../src/contracts/api-error";

describe("api error envelope", () => {
  it("returns a standard error envelope", async () => {
    const response = jsonError("not_found", "Not Found", 404);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(ApiErrorEnvelopeSchema.parse(body)).toEqual({
      code: "not_found",
      message: "Not Found",
    });
  });

  it("maps invalid request errors to invalid_request code", async () => {
    const response = invalidRequest("Invalid enum", { field: "stage" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(ApiErrorEnvelopeSchema.parse(body)).toEqual({
      code: "invalid_request",
      message: "Invalid enum",
      details: { field: "stage" },
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  isValidStageTransition,
  isValidStateTransition,
} from "../../src/contracts/state-machine";

describe("pipeline state machine", () => {
  it("allows legal stage transitions", () => {
    expect(isValidStageTransition("audio", "asr")).toBe(true);
    expect(isValidStageTransition("asr", "segment")).toBe(true);
    expect(isValidStageTransition("segment", "translate")).toBe(true);
    expect(isValidStageTransition("translate", "finalize")).toBe(true);
  });

  it("rejects illegal stage transitions", () => {
    expect(isValidStageTransition("audio", "segment")).toBe(false);
    expect(isValidStageTransition("finalize", "audio")).toBe(false);
  });

  it("allows legal processing state transitions", () => {
    expect(isValidStateTransition("uploaded", "processing")).toBe(true);
    expect(isValidStateTransition("processing", "needs_review")).toBe(true);
    expect(isValidStateTransition("processing", "failed")).toBe(true);
    expect(isValidStateTransition("processing", "manual_intervention")).toBe(true);
  });

  it("rejects illegal processing state transitions", () => {
    expect(isValidStateTransition("uploaded", "needs_review")).toBe(false);
    expect(isValidStateTransition("failed", "processing")).toBe(false);
    expect(isValidStateTransition("manual_intervention", "processing")).toBe(false);
  });
});

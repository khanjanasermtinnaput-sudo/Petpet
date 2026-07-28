import { describe, expect, it } from "vitest";
import {
  feedResultMessage,
  feedTimeoutMessage,
  isTerminalStatus,
  type FeedOutcome,
} from "./feeder-commands";

function outcome(over: Partial<FeedOutcome> = {}): FeedOutcome {
  return { status: "success", target_g: 42, dispensed_g: null, error: null, ...over };
}

describe("isTerminalStatus", () => {
  it("treats success and failed as final", () => {
    expect(isTerminalStatus("success")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
  });

  it("treats pending and running as still in flight", () => {
    expect(isTerminalStatus("pending")).toBe(false);
    expect(isTerminalStatus("running")).toBe(false);
  });
});

describe("feedResultMessage", () => {
  it("reports what the load cell measured, not what was asked for", () => {
    expect(feedResultMessage(outcome({ target_g: 42, dispensed_g: 38.4 }))).toBe(
      "เทอาหารแล้ว 38g",
    );
  });

  it("falls back to target_g when the device reported no weight", () => {
    // An uncalibrated or absent load cell: the food did come out, we just only
    // know how much we asked for.
    expect(feedResultMessage(outcome({ target_g: 42, dispensed_g: null }))).toBe(
      "เทอาหารแล้ว 42g",
    );
  });

  it("rounds rather than truncating", () => {
    expect(feedResultMessage(outcome({ dispensed_g: 41.6 }))).toBe("เทอาหารแล้ว 42g");
    expect(feedResultMessage(outcome({ dispensed_g: 0 }))).toBe("เทอาหารแล้ว 0g");
  });

  it("maps each machine-readable failure code to its own Thai message", () => {
    const codes = [
      "timeout_pickup",
      "timeout_execute",
      "jam",
      "empty_tank",
      "no_scale",
      "aborted",
      "device_error",
    ];
    const messages = codes.map((error) =>
      feedResultMessage(outcome({ status: "failed", error })),
    );

    expect(new Set(messages).size).toBe(codes.length);
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
  });

  it("falls back for an unrecognised or missing error code", () => {
    const fallback = "เทอาหารไม่สำเร็จ กรุณาลองใหม่";
    expect(feedResultMessage(outcome({ status: "failed", error: "who_knows" }))).toBe(
      fallback,
    );
    expect(feedResultMessage(outcome({ status: "failed", error: null }))).toBe(fallback);
  });

  it("does not announce a dispensed weight for a failed command", () => {
    // A jam can still have moved some food; saying "เทอาหารแล้ว 12g" would
    // read as success.
    const message = feedResultMessage(
      outcome({ status: "failed", error: "jam", dispensed_g: 12 }),
    );
    expect(message).not.toContain("12g");
  });
});

describe("feedTimeoutMessage", () => {
  it("distinguishes a feeder that never answered from one that went quiet", () => {
    expect(feedTimeoutMessage("pickup")).not.toBe(feedTimeoutMessage("execute"));
  });

  it("matches the message the server-side expiry would eventually produce", () => {
    // The client gives up before expire_stale_commands() does, so the two
    // paths must not tell the user different stories about the same failure.
    expect(feedTimeoutMessage("pickup")).toBe(
      feedResultMessage(outcome({ status: "failed", error: "timeout_pickup" })),
    );
    expect(feedTimeoutMessage("execute")).toBe(
      feedResultMessage(outcome({ status: "failed", error: "timeout_execute" })),
    );
  });
});

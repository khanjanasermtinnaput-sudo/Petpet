/**
 * How long the dashboard waits before it stops believing in a command.
 *
 * Both are deliberately shorter than the server's expiry windows (60s pickup /
 * 120s execute in expire_stale_commands): waiting for the server's deadlines
 * would leave the feed button spinning for up to three minutes. The client
 * gives up first and pokes device_health(), which runs the lazy expiry so the
 * database agrees with what the user was just told.
 */
export const PENDING_TIMEOUT_MS = 15_000;
export const RUNNING_TIMEOUT_MS = 60_000;

/** How long a settled toast stays up. Matches the pre-existing behaviour. */
export const TOAST_HIDE_MS = 3_000;

/** A command in a terminal state will never change again. */
export function isTerminalStatus(status: string): boolean {
  return status === "success" || status === "failed";
}

/**
 * Thai user-facing text for a machine-readable failure code.
 *
 * The database stores English codes (see the `error` column comment in
 * 0005_feeder_commands.sql) so firmware, SQL and logs share one vocabulary;
 * the translation happens once, here, rather than at each call site.
 */
const ERROR_MESSAGES: Record<string, string> = {
  timeout_pickup: "ไม่พบเครื่องให้อาหาร กรุณาตรวจสอบการเชื่อมต่อ",
  timeout_execute: "เครื่องให้อาหารไม่ตอบสนอง กรุณาลองใหม่อีกครั้ง",
  jam: "อาหารติดขัด กรุณาตรวจสอบช่องจ่ายอาหาร",
  empty_tank: "อาหารในถังหมด กรุณาเติมอาหาร",
  no_scale: "เครื่องชั่งขัดข้อง กรุณาตรวจสอบอุปกรณ์",
  aborted: "การเทอาหารถูกยกเลิก",
  device_error: "เทอาหารไม่สำเร็จ กรุณาลองใหม่",
};

const FALLBACK_ERROR_MESSAGE = "เทอาหารไม่สำเร็จ กรุณาลองใหม่";

/** The subset of a feeder_commands row needed to describe its outcome. */
export interface FeedOutcome {
  status: string;
  target_g: number;
  dispensed_g: number | null;
  error: string | null;
}

/**
 * The message shown once a command reaches a terminal state.
 *
 * Falls back to `target_g` when the device reported success without a weight,
 * which is what happens when the load cell is absent or uncalibrated — the
 * food did come out, we just only know how much we asked for.
 */
export function feedResultMessage(outcome: FeedOutcome): string {
  if (outcome.status === "success") {
    const grams = outcome.dispensed_g ?? outcome.target_g;
    return `เทอาหารแล้ว ${Math.round(grams)}g`;
  }
  return (
    (outcome.error ? ERROR_MESSAGES[outcome.error] : undefined) ??
    FALLBACK_ERROR_MESSAGE
  );
}

/**
 * The message shown when the client's own deadline expires before any status
 * arrives. "pickup" means no device ever claimed the command — almost always
 * an offline feeder; "execute" means one claimed it and then went quiet.
 */
export function feedTimeoutMessage(reason: "pickup" | "execute"): string {
  return reason === "pickup"
    ? ERROR_MESSAGES.timeout_pickup
    : ERROR_MESSAGES.timeout_execute;
}

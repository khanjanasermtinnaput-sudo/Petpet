"use client";

import { NeuCard } from "@/components/neu/NeuCard";

export interface FeedDiagnostic {
  kind: "success" | "error";
  code: string;
  message: string;
  detail?: string;
}

export function FeedCommandStatus({
  diagnostic,
  onDismiss,
}: {
  diagnostic: FeedDiagnostic | null;
  onDismiss: () => void;
}) {
  if (!diagnostic) return null;
  const failed = diagnostic.kind === "error";

  return (
    <NeuCard className={failed ? "border-2 border-red-400" : "border-2 border-neu-success"}>
      <section aria-live="assertive" aria-atomic="true" className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-wide ${failed ? "text-red-600" : "text-neu-success"}`}>
            {failed ? "FEED ERROR" : "FEED COMPLETE"}
          </p>
          <h2 className="mt-1 font-semibold text-neu-ink">{diagnostic.message}</h2>
          <p className="mt-2 text-sm text-neu-ink-muted">
            รหัสข้อผิดพลาด: <code className="font-mono font-semibold">{diagnostic.code}</code>
          </p>
          {diagnostic.detail && <p className="mt-1 text-sm text-neu-ink-muted">{diagnostic.detail}</p>}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-sm font-semibold text-neu-ink-muted underline"
          aria-label="ปิดรายละเอียดคำสั่งให้อาหาร"
        >
          ปิด
        </button>
      </section>
    </NeuCard>
  );
}
import Link from "next/link";

export function LowEatingAlert({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="neu-raised-sm flex items-center justify-between gap-4 border-l-4 border-neu-warning px-5 py-4">
      <div>
        <p className="font-semibold text-neu-warning">
          น้องกินน้อยกว่าปกติในมื้อนี้
        </p>
        <Link
          href="/vet"
          className="neu-focusable mt-1 inline-block rounded text-sm font-semibold text-neu-accent underline underline-offset-2"
        >
          ถาม VET AI
        </Link>
      </div>
      <button
        type="button"
        aria-label="ปิดการแจ้งเตือน"
        onClick={onDismiss}
        className="neu-focusable neu-press-active shrink-0 rounded-full px-2 py-1 text-neu-ink-muted"
      >
        ✕
      </button>
    </div>
  );
}

import { NeuButton } from "@/components/neu/NeuButton";

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onNewChat: () => void;
  onSelect: (id: string) => void;
}

export function ChatHistory({ conversations, selectedId, loading, error, disabled, onNewChat, onSelect }: ChatHistoryProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-neu-ink">VET AI</h2>
        <NeuButton type="button" variant="accent" className="mt-3 w-full" disabled={disabled} onClick={onNewChat}>
          + แชทใหม่
        </NeuButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {loading ? <p className="px-2 text-sm text-neu-ink-muted">กำลังโหลดประวัติ...</p> : null}
        {!loading && error ? <p role="alert" className="px-2 text-sm font-semibold text-neu-warning">{error}</p> : null}
        {!loading && !error && conversations.length === 0 ? (
          <p className="px-2 text-sm text-neu-ink-muted">ยังไม่มีประวัติแชท เริ่มถาม VET AI ได้เลย</p>
        ) : null}
        <div className="flex flex-col gap-1">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              disabled={disabled}
              aria-current={conversation.id === selectedId ? "page" : undefined}
              className={`neu-focusable w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${conversation.id === selectedId ? "neu-inset text-neu-accent" : "text-neu-ink-muted hover:text-neu-ink"}`}
              onClick={() => onSelect(conversation.id)}
              title={conversation.title}
            >
              <span className="block truncate">{conversation.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

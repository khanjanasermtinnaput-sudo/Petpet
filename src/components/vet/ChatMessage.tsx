export interface ChatMessageData {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageData) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`neu-raised-sm max-w-[80%] whitespace-pre-wrap px-4 py-3 text-sm ${
          isUser ? "text-neu-accent" : "text-neu-ink"
        }`}
      >
        {content || (isUser ? "" : "…")}
      </div>
    </div>
  );
}

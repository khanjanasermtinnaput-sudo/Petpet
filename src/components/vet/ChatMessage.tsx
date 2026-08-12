import Image from "next/image";

export interface ChatMessageData {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/**
 * Renders plain text with any bare URLs (e.g. from grounding references) as
 * clickable links. Splitting on a capturing group alternates plain text and
 * matched URLs starting at index 0, so odd indices are always the URLs —
 * safer than re-testing each part against URL_PATTERN, whose `g` flag would
 * carry stateful lastIndex across repeated .test() calls.
 */
function linkifyContent(content: string) {
  return content.split(URL_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-neu-accent underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function ChatMessage({ role, content, imageUrl }: ChatMessageData) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`neu-raised-sm max-w-[80%] whitespace-pre-wrap px-4 py-3 text-sm ${
          isUser ? "text-neu-accent" : "text-neu-ink"
        }`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt="รูปภาพที่แนบในแชท"
            width={480}
            height={360}
            unoptimized
            className="mb-2 max-h-72 w-full rounded-xl object-cover"
          />
        ) : null}
        {content ? linkifyContent(content) : isUser ? "" : "…"}
      </div>
    </div>
  );
}

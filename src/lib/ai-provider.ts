import { GoogleGenAI } from "@google/genai";
import LlamaAPIClient from "llama-api-client";

export type AiChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type StructuredGenerationRequest = {
  prompt: string;
  schema: unknown;
};

export class AiProviderConfigurationError extends Error {}

/** Each provider's env var accepts a comma-separated list — a single value with no comma keeps working exactly as before. */
function parseKeys(envValue: string | undefined): string[] {
  return (envValue ?? "").split(",").map((key) => key.trim()).filter(Boolean);
}

function geminiKeys(): string[] {
  const keys = parseKeys(process.env.GEMINI_API_KEY);
  if (keys.length === 0) throw new AiProviderConfigurationError("GEMINI_API_KEY is not configured");
  return keys;
}

function llamaKeys(): string[] {
  const keys = parseKeys(process.env.LLAMA_API_KEY);
  if (keys.length === 0) throw new AiProviderConfigurationError("LLAMA_API_KEY is not configured");
  return keys;
}

function openRouterKeys(): string[] {
  const keys = parseKeys(process.env.OPENROUTER_API_KEY);
  if (keys.length === 0) throw new AiProviderConfigurationError("OPENROUTER_API_KEY is not configured");
  return keys;
}

// OpenRouter's free-tier catalog shifts over time — check openrouter.ai/models
// for what's currently free if this default ever stops resolving, or set
// OPENROUTER_MODEL to pin a specific model explicitly. Deliberately not a
// "reasoning" model (e.g. gpt-oss/nemotron-nano's free tiers): those stream
// their answer into a separate `reasoning` field and can leave `content`
// empty for a while (or entirely, if the token budget runs out first) —
// verified live against gemma here, so this default is one that populates
// `content` directly.
const DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b-it:free";
const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

function resolveOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

/**
 * True for any provider's rate-limit response. Gemini and Llama's SDKs both
 * throw OpenAI-SDK-style errors exposing the HTTP status as `.status`
 * (confirmed in llama-api-client's source: its RateLimitError is
 * `status: 429`); OpenRouter's fetch-based errors below are constructed to
 * carry the same shape, so one check works for all three.
 */
function isRateLimitError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "status" in error
    && (error as { status?: unknown }).status === 429;
}

/**
 * Tries each key in order for a non-streaming call. Any non-rate-limit error
 * aborts immediately (no point trying another key for a bad request or a
 * server error); only once every key has failed with a rate limit does this
 * throw that last error, so callers can keep using
 * `if (!isRateLimitError(error)) throw error;` to decide whether to fall
 * through to the next provider.
 */
async function tryWithKeyRotation<T>(keys: string[], attempt: (apiKey: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const key of keys) {
    try {
      return await attempt(key);
    } catch (error) {
      if (!isRateLimitError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Streaming counterpart of tryWithKeyRotation. A key is only abandoned for
 * the next one if it fails with a rate limit before yielding any chunk —
 * once text has reached the caller it is never retried under a different
 * key, mirroring the existing emittedText guard at the Gemini -> Llama
 * boundary.
 */
async function* tryWithKeyRotationStream(
  keys: string[],
  attempt: (apiKey: string) => AsyncGenerator<string>,
): AsyncGenerator<string> {
  let lastError: unknown;
  for (const key of keys) {
    let emittedText = false;
    try {
      for await (const chunk of attempt(key)) {
        emittedText = true;
        yield chunk;
      }
      return;
    } catch (error) {
      if (emittedText || !isRateLimitError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

function llamaMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}

async function resolveLlamaModel(client: LlamaAPIClient): Promise<string> {
  const configured = process.env.LLAMA_MODEL?.trim();
  if (configured) return configured;

  // An account can expose a different Llama model set over time. Selecting the
  // first currently available model lets a user configure only LLAMA_API_KEY;
  // LLAMA_MODEL remains available as a stable explicit override.
  const models = await client.models.list();
  const model = models[0]?.id;
  if (!model) throw new AiProviderConfigurationError("No Llama models are available for this API key");
  return model;
}

async function callGeminiSchedule(apiKey: string, prompt: string, schema: unknown): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: schema,
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  if (!response.text) throw new Error("empty Gemini response");
  return response.text;
}

async function callLlamaSchedule(apiKey: string, prompt: string, schema: unknown): Promise<string> {
  const client = new LlamaAPIClient({ apiKey });
  const response = await client.chat.completions.create({
    model: await resolveLlamaModel(client),
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 1024,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: { name: "petpet_feeding_schedule", schema },
    },
  });
  const text = llamaMessageContent(response.completion_message.content);
  if (!text) throw new Error("empty Llama response");
  return text;
}

async function callOpenRouterSchedule(apiKey: string, prompt: string, schema: unknown): Promise<string> {
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenRouterModel(),
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: { name: "petpet_feeding_schedule", schema, strict: true },
      },
    }),
  });
  if (!response.ok) throw Object.assign(new Error(`OpenRouter request failed: ${response.status}`), { status: response.status });
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty OpenRouter response");
  return text;
}

/**
 * Generates the schedule through Gemini first (rotating through every
 * configured Gemini key on a 429 before giving up on Gemini), falling
 * through to Llama and then OpenRouter — each of which likewise rotates
 * through its own configured keys — only once the provider before it is
 * fully exhausted (every key rate-limited for Gemini; any failure at all,
 * including a missing key, for Llama and OpenRouter). All callers still
 * validate the returned JSON regardless of which provider produced it.
 */
export async function generateScheduleText({ prompt, schema }: StructuredGenerationRequest): Promise<string> {
  try {
    return await tryWithKeyRotation(geminiKeys(), (key) => callGeminiSchedule(key, prompt, schema));
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    try {
      return await tryWithKeyRotation(llamaKeys(), (key) => callLlamaSchedule(key, prompt, schema));
    } catch {
      return await tryWithKeyRotation(openRouterKeys(), (key) => callOpenRouterSchedule(key, prompt, schema));
    }
  }
}

/**
 * OpenRouter's chat completions endpoint is OpenAI-compatible: SSE lines of
 * `data: {...}`, terminated by a literal `data: [DONE]` line. No SDK needed
 * for this shape, just a fetch + manual line-buffered parse.
 */
async function* streamOpenRouterOnce(apiKey: string, systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenRouterModel(),
      messages: [
        { role: "system", content: systemInstruction },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      ],
      max_tokens: 1024,
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    throw Object.assign(new Error(`OpenRouter request failed: ${response.status}`), { status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const payload = line.trim();
      if (!payload.startsWith("data:")) continue;
      const data = payload.slice("data:".length).trim();
      if (data === "[DONE]") return;
      let parsed: { choices?: { delta?: { content?: string } }[] };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

/** Rotates through every configured OpenRouter key; this is the last resort, so a failure here propagates to the caller. */
async function* streamOpenRouterVetReply(systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  yield* tryWithKeyRotationStream(openRouterKeys(), (key) => streamOpenRouterOnce(key, systemInstruction, history));
}

async function* streamLlamaOnce(apiKey: string, systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  const client = new LlamaAPIClient({ apiKey });
  const stream = await client.chat.completions.create({
    model: await resolveLlamaModel(client),
    messages: [
      { role: "system", content: systemInstruction },
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    ],
    max_completion_tokens: 1024,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.event.delta;
    if (delta.type === "text" && delta.text) yield delta.text;
  }
}

/** Rotates through every configured Llama key, then falls through to OpenRouter on any failure (missing key, exhausted rate limit, or any other error). */
async function* streamLlamaVetReply(systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  try {
    yield* tryWithKeyRotationStream(llamaKeys(), (key) => streamLlamaOnce(key, systemInstruction, history));
  } catch {
    yield* streamOpenRouterVetReply(systemInstruction, history);
  }
}

/** Renders grounding sources as a Thai references block, deduped by uri. */
function formatGroundingReferences(chunks: { web?: { title?: string; uri?: string } }[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    lines.push(`- ${chunk.web?.title ?? uri}: ${uri}`);
  }
  if (lines.length === 0) return "";
  return `\n\nอ้างอิงข้อมูลจาก:\n${lines.join("\n")}`;
}

async function* streamGeminiOnce(apiKey: string, systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey });
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    config: { maxOutputTokens: 1024, systemInstruction, tools: [{ googleSearch: {} }] },
    contents: history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
  });
  let groundingChunks: { web?: { title?: string; uri?: string } }[] = [];
  for await (const chunk of stream) {
    const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks?.length) groundingChunks = chunks;
    if (!chunk.text) continue;
    yield chunk.text;
  }
  const references = formatGroundingReferences(groundingChunks);
  if (references) yield references;
}

/**
 * Streams a VET reply without changing the public NDJSON protocol. Once text
 * has been emitted it is never replaced, so falling from Gemini through to
 * Llama then OpenRouter is limited to a rate limit before the user has
 * received any response content — Gemini rotates through every configured
 * key first and only falls through once all of them are 429'd; Llama and
 * OpenRouter (see streamLlamaVetReply/streamOpenRouterVetReply) do the same
 * with their own keys before falling through further.
 *
 * Google Search grounding is enabled but left to the model's own judgment —
 * only questions it decides need a live lookup come back with sources, so a
 * references block is not appended to every reply. Neither Llama nor
 * OpenRouter support grounding, so a reply served by either fallback never
 * carries sources.
 */
export async function* streamVetReply(systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  try {
    yield* tryWithKeyRotationStream(geminiKeys(), (key) => streamGeminiOnce(key, systemInstruction, history));
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    yield* streamLlamaVetReply(systemInstruction, history);
  }
}

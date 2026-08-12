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

function requireGeminiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiProviderConfigurationError("GEMINI_API_KEY is not configured");
  return apiKey;
}

function requireLlamaKey(): string {
  const apiKey = process.env.LLAMA_API_KEY?.trim();
  if (!apiKey) throw new AiProviderConfigurationError("LLAMA_API_KEY is not configured");
  return apiKey;
}

function requireOpenRouterKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new AiProviderConfigurationError("OPENROUTER_API_KEY is not configured");
  return apiKey;
}

// OpenRouter's free-tier catalog shifts over time — check openrouter.ai/models
// for what's currently free if this default ever stops resolving, or set
// OPENROUTER_MODEL to pin a specific model explicitly.
const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

function resolveOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

/** Only Gemini's upstream 429 response is eligible for Llama fallback. */
export function isGeminiRateLimitError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "status" in error
    && (error as { status?: unknown }).status === 429;
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

async function generateLlamaStructuredText({ prompt, schema }: StructuredGenerationRequest): Promise<string> {
  const client = new LlamaAPIClient({ apiKey: requireLlamaKey() });
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

async function generateOpenRouterStructuredText({ prompt, schema }: StructuredGenerationRequest): Promise<string> {
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenRouterKey()}`,
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
  if (!response.ok) throw new Error(`OpenRouter request failed: ${response.status}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty OpenRouter response");
  return text;
}

/**
 * Generates the schedule through Gemini first, falling through to Llama and
 * then OpenRouter only when Gemini has exhausted its rate limit — and each
 * further step only if the one before it also failed (missing key, its own
 * rate limit, or any other error). All callers still validate the returned
 * JSON regardless of which provider produced it.
 */
export async function generateScheduleText({ prompt, schema }: StructuredGenerationRequest): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: requireGeminiKey() });
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
  } catch (error) {
    if (!isGeminiRateLimitError(error)) throw error;
    try {
      return await generateLlamaStructuredText({ prompt, schema });
    } catch {
      return await generateOpenRouterStructuredText({ prompt, schema });
    }
  }
}

/**
 * OpenRouter's chat completions endpoint is OpenAI-compatible: SSE lines of
 * `data: {...}`, terminated by a literal `data: [DONE]` line. No SDK needed
 * for this shape, just a fetch + manual line-buffered parse.
 */
async function* streamOpenRouterVetReply(systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenRouterKey()}`,
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
  if (!response.ok || !response.body) throw new Error(`OpenRouter request failed: ${response.status}`);

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

/** Falls through to OpenRouter if Llama fails before emitting any text (missing key, its own rate limit, or any other error). */
async function* streamLlamaVetReply(systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  let emittedText = false;
  try {
    const client = new LlamaAPIClient({ apiKey: requireLlamaKey() });
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
      if (delta.type === "text" && delta.text) {
        emittedText = true;
        yield delta.text;
      }
    }
  } catch (error) {
    if (emittedText) throw error;
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

/**
 * Streams a VET reply without changing the public NDJSON protocol. Once text
 * has been emitted it is never replaced, so entering the Gemini -> Llama ->
 * OpenRouter fallback chain is limited to a Gemini 429 before the user has
 * received any response content; each further step is likewise only taken
 * if the previous one failed before emitting anything.
 *
 * Google Search grounding is enabled but left to the model's own judgment —
 * only questions it decides need a live lookup come back with sources, so a
 * references block is not appended to every reply. Neither Llama nor
 * OpenRouter support grounding, so a reply served by either fallback never
 * carries sources.
 */
export async function* streamVetReply(systemInstruction: string, history: AiChatTurn[]): AsyncGenerator<string> {
  let emittedText = false;
  let groundingChunks: { web?: { title?: string; uri?: string } }[] = [];
  try {
    const ai = new GoogleGenAI({ apiKey: requireGeminiKey() });
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: { maxOutputTokens: 1024, systemInstruction, tools: [{ googleSearch: {} }] },
      contents: history.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      })),
    });
    for await (const chunk of stream) {
      const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks?.length) groundingChunks = chunks;
      if (!chunk.text) continue;
      emittedText = true;
      yield chunk.text;
    }
    const references = formatGroundingReferences(groundingChunks);
    if (references) yield references;
  } catch (error) {
    if (!emittedText && isGeminiRateLimitError(error)) {
      yield* streamLlamaVetReply(systemInstruction, history);
      return;
    }
    throw error;
  }
}

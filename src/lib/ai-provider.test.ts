import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGeminiGenerate,
  mockGeminiStream,
  mockLlamaCreate,
  mockLlamaModels,
} = vi.hoisted(() => ({
  mockGeminiGenerate: vi.fn(),
  mockGeminiStream: vi.fn(),
  mockLlamaCreate: vi.fn(),
  mockLlamaModels: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
    return {
      models: {
        generateContent: mockGeminiGenerate,
        generateContentStream: mockGeminiStream,
      },
    };
  }),
}));

vi.mock("llama-api-client", () => ({
  default: vi.fn().mockImplementation(function LlamaAPIClient() {
    return {
      models: { list: mockLlamaModels },
      chat: { completions: { create: mockLlamaCreate } },
    };
  }),
}));

import { generateScheduleText, streamVetReply } from "./ai-provider";

async function* textStream(...texts: string[]) {
  for (const text of texts) yield { text };
}

async function* llamaTextStream(...texts: string[]) {
  for (const text of texts) {
    yield { event: { delta: { type: "text" as const, text }, event_type: "progress" as const } };
  }
}

describe("AI provider fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    vi.stubEnv("LLAMA_API_KEY", "llama-key");
    vi.stubEnv("LLAMA_MODEL", "");
    mockLlamaModels.mockResolvedValue([{ id: "llama-enabled-model" }]);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("uses Gemini for a valid schedule without contacting Llama", async () => {
    mockGeminiGenerate.mockResolvedValue({ text: '{"meals":[]}' });

    await expect(generateScheduleText({ prompt: "schedule", schema: { type: "object" } })).resolves.toBe('{"meals":[]}');

    expect(mockGeminiGenerate).toHaveBeenCalledTimes(1);
    expect(mockLlamaModels).not.toHaveBeenCalled();
    expect(mockLlamaCreate).not.toHaveBeenCalled();
  });

  it("uses Llama structured output only after Gemini returns 429", async () => {
    mockGeminiGenerate.mockRejectedValue({ status: 429 });
    mockLlamaCreate.mockResolvedValue({ completion_message: { content: '{"meals":[]}' } });

    await expect(generateScheduleText({ prompt: "schedule", schema: { type: "object" } })).resolves.toBe('{"meals":[]}');

    expect(mockLlamaModels).toHaveBeenCalledTimes(1);
    expect(mockLlamaCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "llama-enabled-model",
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
  });

  it("does not hide non-rate-limit Gemini failures behind Llama", async () => {
    const upstreamError = { status: 500 };
    mockGeminiGenerate.mockRejectedValue(upstreamError);

    await expect(generateScheduleText({ prompt: "schedule", schema: { type: "object" } })).rejects.toBe(upstreamError);

    expect(mockLlamaModels).not.toHaveBeenCalled();
    expect(mockLlamaCreate).not.toHaveBeenCalled();
  });

  it("streams Gemini chat normally without Llama", async () => {
    mockGeminiStream.mockResolvedValue(textStream("สวัสดี", "ครับ"));

    const response = [];
    for await (const text of streamVetReply("system", [{ role: "user", content: "hello" }])) response.push(text);

    expect(response).toEqual(["สวัสดี", "ครับ"]);
    expect(mockLlamaCreate).not.toHaveBeenCalled();
  });

  it("switches a chat stream to Llama when Gemini is rate limited before output", async () => {
    mockGeminiStream.mockRejectedValue({ status: 429 });
    mockLlamaCreate.mockResolvedValue(llamaTextStream("Llama ", "ตอบแล้ว"));

    const response = [];
    for await (const text of streamVetReply("system", [{ role: "user", content: "hello" }])) response.push(text);

    expect(response.join("")).toBe("Llama ตอบแล้ว");
    expect(mockLlamaCreate).toHaveBeenCalledWith(expect.objectContaining({ stream: true, model: "llama-enabled-model" }));
  });
});

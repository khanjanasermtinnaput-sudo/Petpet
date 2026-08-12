import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAnalyzeVetImage, mockCreateClient, mockGetChatContext, mockStreamVetReply } = vi.hoisted(() => ({
  mockAnalyzeVetImage: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetChatContext: vi.fn(),
  mockStreamVetReply: vi.fn(),
}));

vi.mock("@/lib/ai-provider", () => ({ streamVetReply: mockStreamVetReply }));
vi.mock("@/lib/chat-context", () => ({ getChatContext: mockGetChatContext }));
vi.mock("@/lib/openrouter-vision", () => ({ analyzeVetImage: mockAnalyzeVetImage }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { POST } from "./route";

const conversation = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  title: "ดูรูปนี้ให้หน่อย",
  created_at: "2026-08-13T00:00:00.000Z",
  updated_at: "2026-08-13T00:00:00.000Z",
};

function createContextStub() {
  const insertedMessages: Array<Record<string, unknown>> = [];
  const uploaded: Array<{ path: string; file: File }> = [];
  const chatClient = {
    from: vi.fn((table: string) => {
      if (table === "chat_conversations") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: conversation, error: null }) })),
          })),
        };
      }
      if (table !== "chat_messages") throw new Error(`unexpected table: ${table}`);
      return {
        select: vi.fn((columns: string) => {
          const query: Record<string, unknown> = {};
          query.eq = vi.fn(() => query);
          query.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
          query.order = vi.fn().mockResolvedValue({
            data: columns === "role, content"
              ? insertedMessages.map(({ role, content }) => ({ role, content }))
              : [],
            error: null,
          });
          return query;
        }),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          insertedMessages.push(row);
          return { error: null };
        }),
      };
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (path: string, file: File) => {
          uploaded.push({ path, file });
          return { error: null };
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  };
  return { chatClient, insertedMessages, uploaded };
}

function feedClientStub() {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.order = vi.fn().mockResolvedValue({ data: [], error: null });
  return { from: vi.fn(() => query) };
}

function multipartRequest() {
  const form = new FormData();
  form.set("message", "ดูรูปนี้ให้หน่อย");
  form.set("clientMessageId", "223e4567-e89b-42d3-a456-426614174000");
  form.set("image", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "pet.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/chat", { method: "POST", body: form });
}

describe("POST /api/chat image pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    mockCreateClient.mockResolvedValue(feedClientStub());
    mockStreamVetReply.mockImplementation(async function* () { yield "คำตอบจาก VET AI"; });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("uploads an image, injects vision context only into the model turn, and streams one final reply", async () => {
    const context = createContextStub();
    mockGetChatContext.mockResolvedValue({
      user: { id: "323e4567-e89b-42d3-a456-426614174000" },
      pet: { name: "โมจิ", species: "Cat", breed: null, age_years: 2, age_months: 0, weight_kg: 4, daily_target_g: 60 },
      chatClient: context.chatClient,
    });
    mockAnalyzeVetImage.mockResolvedValue("เห็นรอยแดงเล็กน้อยบริเวณใบหู");

    const response = await POST(multipartRequest());
    const streamText = await response.text();

    expect(response.status).toBe(200);
    expect(streamText).toContain("กำลังดูภาพ...");
    expect(streamText).toContain("คำตอบจาก VET AI");
    expect(context.uploaded[0].path).toMatch(/323e4567.*\/123e4567.*\/223e4567.*\.jpg$/);
    expect(context.insertedMessages[0]).toMatchObject({ content: "ดูรูปนี้ให้หน่อย", image_mime_type: "image/jpeg" });
    expect(JSON.stringify(context.insertedMessages)).not.toContain("เห็นรอยแดง");
    const modelTurns = mockStreamVetReply.mock.calls[0][1] as Array<{ role: string; content: string }>;
    expect(modelTurns.at(-1)?.content).toContain("ข้อมูลจากภาพที่ผู้ใช้แนบมา");
    expect(modelTurns.at(-1)?.content).toContain("เห็นรอยแดง");
  });

  it("continues to the main model with a Thai notice when vision fails", async () => {
    const context = createContextStub();
    mockGetChatContext.mockResolvedValue({
      user: { id: "323e4567-e89b-42d3-a456-426614174000" },
      pet: { name: "โมจิ", species: "Cat", breed: null, age_years: 2, age_months: 0, weight_kg: 4, daily_target_g: 60 },
      chatClient: context.chatClient,
    });
    mockAnalyzeVetImage.mockRejectedValue(new Error("timeout"));

    const response = await POST(multipartRequest());
    const streamText = await response.text();

    expect(response.status).toBe(200);
    expect(streamText).toContain("ระบบอ่านภาพไม่สำเร็จ");
    expect(streamText).toContain("คำตอบจาก VET AI");
    expect(mockStreamVetReply).toHaveBeenCalledOnce();
    expect(context.insertedMessages.at(-1)?.content).toContain("ระบบอ่านภาพไม่สำเร็จ");
  });

  it("keeps the existing JSON request contract for text-only chat", async () => {
    const context = createContextStub();
    mockGetChatContext.mockResolvedValue({
      user: { id: "323e4567-e89b-42d3-a456-426614174000" },
      pet: { name: "โมจิ", species: "Cat", breed: null, age_years: 2, age_months: 0, weight_kg: 4, daily_target_g: 60 },
      chatClient: context.chatClient,
    });
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "วันนี้กินน้อย", clientMessageId: "223e4567-e89b-42d3-a456-426614174000" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("คำตอบจาก VET AI");
    expect(mockAnalyzeVetImage).not.toHaveBeenCalled();
    expect(context.uploaded).toHaveLength(0);
  });
});

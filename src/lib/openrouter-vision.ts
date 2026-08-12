const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_VISION_MODEL = "~google/gemini-flash-latest";
const VISION_TIMEOUT_MS = 18_000;

export const VET_VISION_SYSTEM_PROMPT = `คุณเป็นผู้ช่วยสัตวแพทย์ที่กำลังอธิบายภาพให้สัตวแพทย์ AI อีกตัวฟัง หน้าที่ของคุณคือบรรยายสิ่งที่เห็นในภาพอย่างละเอียดและเป็นกลาง โดยเน้น: (1) ชนิดสัตว์และลักษณะทั่วไปที่สังเกตได้ (2) ความผิดปกติทางกายภาพที่มองเห็น เช่น บาดแผล ผื่น บวม ขนร่วง ท่าทางผิดปกติ ของเหลวผิดปกติ (3) บริบทแวดล้อม เช่น สภาพอาหาร ที่นอน สภาพแวดล้อม ถ้าภาพนั้นเกี่ยวข้อง ห้ามวินิจฉัยโรคหรือให้คำแนะนำการรักษา — หน้าที่คุณคือ "บรรยายสิ่งที่เห็น" เท่านั้น ให้ AI อีกตัวเป็นคนวิเคราะห์ต่อ ตอบเป็นภาษาไทย กระชับ ไม่เกิน 150 คำ`;

export type VisionErrorCode = "not_configured" | "unauthorized" | "no_credit" | "rate_limited" | "invalid_request" | "timeout" | "unavailable" | "invalid_response";

export class OpenRouterVisionError extends Error {
  constructor(public readonly code: VisionErrorCode, message: string, public readonly status?: number) {
    super(message);
    this.name = "OpenRouterVisionError";
  }
}

function configuredKeys(): string[] {
  return (process.env.OPENROUTER_API_KEY ?? "").split(",").map((key) => key.trim()).filter(Boolean);
}

export function resolveVisionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
}

function responseText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("choices" in payload) || !Array.isArray(payload.choices)) return "";
  const content = (payload.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();
  }
  return "";
}

function errorForStatus(status: number): OpenRouterVisionError {
  if (status === 401 || status === 403) return new OpenRouterVisionError("unauthorized", "OpenRouter API key ใช้งานไม่ได้", status);
  if (status === 402) return new OpenRouterVisionError("no_credit", "OpenRouter ไม่มีเครดิตเพียงพอ", status);
  if (status === 429) return new OpenRouterVisionError("rate_limited", "OpenRouter จำกัดจำนวนคำขอชั่วคราว", status);
  if (status >= 400 && status < 500) return new OpenRouterVisionError("invalid_request", "OpenRouter ไม่สามารถอ่านรูปภาพนี้ได้", status);
  return new OpenRouterVisionError("unavailable", "OpenRouter ไม่พร้อมใช้งานชั่วคราว", status);
}

async function requestVision(apiKey: string, image: File): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveVisionModel(),
        messages: [
          { role: "system", content: VET_VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "บรรยายสิ่งที่มองเห็นในภาพนี้เพื่อใช้เป็นข้อมูลประกอบคำถามของเจ้าของสัตว์เลี้ยง" },
              { type: "image_url", image_url: { url: `data:${image.type};base64,${base64}` } },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0,
      }),
    });
    if (!response.ok) throw errorForStatus(response.status);
    const text = responseText(await response.json());
    if (!text) throw new OpenRouterVisionError("invalid_response", "OpenRouter ไม่ส่งคำบรรยายภาพกลับมา");
    return text;
  } catch (error) {
    if (error instanceof OpenRouterVisionError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterVisionError("timeout", "OpenRouter ใช้เวลาอ่านภาพนานเกินไป");
    }
    throw new OpenRouterVisionError("unavailable", "เชื่อมต่อ OpenRouter ไม่สำเร็จ");
  } finally {
    clearTimeout(timeout);
  }
}

async function requestWithOneRetry(apiKey: string, image: File): Promise<string> {
  try {
    return await requestVision(apiKey, image);
  } catch (error) {
    if (!(error instanceof OpenRouterVisionError) || !["timeout", "unavailable"].includes(error.code)) throw error;
    return requestVision(apiKey, image);
  }
}

export async function analyzeVetImage(image: File): Promise<string> {
  const keys = configuredKeys();
  if (keys.length === 0) throw new OpenRouterVisionError("not_configured", "ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY");

  let lastRateLimit: OpenRouterVisionError | undefined;
  for (const key of keys) {
    try {
      return await requestWithOneRetry(key, image);
    } catch (error) {
      if (error instanceof OpenRouterVisionError && error.code === "rate_limited") {
        lastRateLimit = error;
        continue;
      }
      throw error;
    }
  }
  throw lastRateLimit ?? new OpenRouterVisionError("unavailable", "OpenRouter ไม่พร้อมใช้งานชั่วคราว");
}

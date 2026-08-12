import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeVetImage, OpenRouterVisionError, resolveVisionModel, VET_VISION_SYSTEM_PROMPT } from "./openrouter-vision";

function jpegFile() {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "pet.jpg", { type: "image/jpeg" });
}

function okResponse(text = "เห็นแมวสีขาวมีรอยแดงบริเวณใบหู") {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenRouter VET vision", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "vision-key");
    vi.stubEnv("OPENROUTER_VISION_MODEL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the live Flash alias unless an override is configured", () => {
    expect(resolveVisionModel()).toBe("~google/gemini-flash-latest");
    vi.stubEnv("OPENROUTER_VISION_MODEL", "google/custom-vision");
    expect(resolveVisionModel()).toBe("google/custom-vision");
  });

  it("sends text before a base64 image and returns only the description", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeVetImage(jpegFile())).resolves.toContain("รอยแดง");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.messages[0].content).toBe(VET_VISION_SYSTEM_PROMPT);
    expect(request.messages[1].content[0].type).toBe("text");
    expect(request.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("retries one network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeVetImage(jpegFile())).resolves.toContain("แมว");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an invalid key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeVetImage(jpegFile())).rejects.toMatchObject({ code: "unauthorized" } satisfies Partial<OpenRouterVisionError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry other 4xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeVetImage(jpegFile())).rejects.toMatchObject({ code: "invalid_request" } satisfies Partial<OpenRouterVisionError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rotates to the next configured key on a rate limit", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "first,second");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 429 })).mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeVetImage(jpegFile())).resolves.toContain("แมว");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer second");
  });
});

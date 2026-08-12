import { describe, expect, it } from "vitest";
import { hasMatchingImageSignature, imageExtension, isAcceptedVetImage } from "./vet-chat-image";

describe("VET AI image validation", () => {
  it("accepts supported browser formats and HEIC extensions", () => {
    expect(isAcceptedVetImage({ name: "cat.png", type: "image/png" })).toBe(true);
    expect(isAcceptedVetImage({ name: "iphone.HEIC", type: "" })).toBe(true);
    expect(isAcceptedVetImage({ name: "notes.pdf", type: "application/pdf" })).toBe(false);
  });

  it("checks the declared format against file magic bytes", () => {
    expect(hasMatchingImageSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg")).toBe(true);
    expect(hasMatchingImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(hasMatchingImageSignature(new TextEncoder().encode("RIFF1234WEBP"), "image/webp")).toBe(true);
    expect(hasMatchingImageSignature(new TextEncoder().encode("not-an-image"), "image/jpeg")).toBe(false);
  });

  it("maps output MIME types to safe storage extensions", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/webp")).toBe("webp");
  });
});

export const VET_CHAT_IMAGE_MAX_BYTES = 1024 * 1024;
export const VET_CHAT_IMAGE_MAX_DIMENSION = 1568;
export const VET_CHAT_IMAGE_BUCKET = "vet-chat-images";

export const VET_CHAT_IMAGE_INPUT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const VET_CHAT_IMAGE_OUTPUT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type VetChatImageOutputType = (typeof VET_CHAT_IMAGE_OUTPUT_TYPES)[number];

export class VetChatImageError extends Error {
  constructor(
    public readonly code: "unsupported" | "corrupt" | "too_large" | "compression_failed",
    message: string,
  ) {
    super(message);
    this.name = "VetChatImageError";
  }
}

export function isAcceptedVetImage(file: Pick<File, "name" | "type">): boolean {
  const mime = file.type.toLowerCase();
  const extension = file.name.toLowerCase().split(".").pop();
  return VET_CHAT_IMAGE_INPUT_TYPES.includes(mime as (typeof VET_CHAT_IMAGE_INPUT_TYPES)[number])
    || extension === "heic"
    || extension === "heif";
}

export function imageExtension(mimeType: VetChatImageOutputType): "jpg" | "png" | "webp" {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function hasMatchingImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function validateCompressedVetImage(file: File): Promise<VetChatImageOutputType> {
  if (!VET_CHAT_IMAGE_OUTPUT_TYPES.includes(file.type as VetChatImageOutputType)) {
    throw new VetChatImageError("unsupported", "รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG, WebP หรือ HEIC เท่านั้น");
  }
  if (file.size <= 0) throw new VetChatImageError("corrupt", "ไฟล์รูปภาพว่างเปล่าหรือเสีย กรุณาเลือกรูปอื่น");
  if (file.size > VET_CHAT_IMAGE_MAX_BYTES) {
    throw new VetChatImageError("too_large", "รูปภาพยังมีขนาดเกิน 1MB กรุณาเลือกรูปอื่นหรือลองใหม่");
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasMatchingImageSignature(header, file.type)) {
    throw new VetChatImageError("corrupt", "ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกรูปอื่น");
  }
  return file.type as VetChatImageOutputType;
}

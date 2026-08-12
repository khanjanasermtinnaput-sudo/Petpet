import {
  VET_CHAT_IMAGE_MAX_BYTES,
  VET_CHAT_IMAGE_MAX_DIMENSION,
  VetChatImageError,
  isAcceptedVetImage,
} from "./vet-chat-image";

export type ImageCompressionMetadata = {
  originalBytes: number;
  compressedBytes: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  mimeType: "image/jpeg";
  attempts: number;
};

export type CompressedImage = {
  file: File;
  metadata: ImageCompressionMetadata;
};

const QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
const DIMENSION_SCALES = [1, 0.85, 0.7, 0.55, 0.4, 0.3];

export function fitWithinDimension(width: number, height: number, maximum = VET_CHAT_IMAGE_MAX_DIMENSION) {
  const scale = Math.min(1, maximum / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function compressionCandidates(width: number, height: number) {
  const fitted = fitWithinDimension(width, height);
  return DIMENSION_SCALES.flatMap((scale) => QUALITY_STEPS.map((quality) => ({
    width: Math.max(1, Math.round(fitted.width * scale)),
    height: Math.max(1, Math.round(fitted.height * scale)),
    quality,
  })));
}

function isHeic(file: File): boolean {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return mime === "image/heic" || mime === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

async function normalizeHeic(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;
  try {
    const { heicTo } = await import("heic-to/csp");
    return await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  } catch {
    throw new VetChatImageError("corrupt", "ไม่สามารถอ่านไฟล์ HEIC นี้ได้ กรุณาเลือกรูปอื่นหรือตั้งค่ากล้องให้บันทึกเป็น JPEG");
  }
}

async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new VetChatImageError("corrupt", "ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกรูปอื่น");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new VetChatImageError("compression_failed", "บีบอัดรูปภาพไม่สำเร็จ กรุณาลองเลือกรูปอื่น")),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressVetChatImage(file: File): Promise<CompressedImage> {
  if (!isAcceptedVetImage(file)) {
    throw new VetChatImageError("unsupported", "รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG, WebP หรือ HEIC เท่านั้น");
  }
  if (file.size <= 0) throw new VetChatImageError("corrupt", "ไฟล์รูปภาพว่างเปล่าหรือเสีย กรุณาเลือกรูปอื่น");

  const normalized = await normalizeHeic(file);
  const bitmap = await decodeImage(normalized);
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    throw new VetChatImageError("compression_failed", "อุปกรณ์นี้ไม่สามารถบีบอัดรูปภาพได้ กรุณาลองใช้รูปที่มีขนาดเล็กกว่า");
  }

  let attempts = 0;
  try {
    for (const candidate of compressionCandidates(originalWidth, originalHeight)) {
      attempts += 1;
      canvas.width = candidate.width;
      canvas.height = candidate.height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, candidate.width, candidate.height);
      context.drawImage(bitmap, 0, 0, candidate.width, candidate.height);
      const blob = await canvasToBlob(canvas, candidate.quality);
      if (blob.size <= VET_CHAT_IMAGE_MAX_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "vet-image";
        return {
          file: new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() }),
          metadata: {
            originalBytes: file.size,
            compressedBytes: blob.size,
            originalWidth,
            originalHeight,
            width: candidate.width,
            height: candidate.height,
            mimeType: "image/jpeg",
            attempts,
          },
        };
      }
    }
  } finally {
    bitmap.close();
  }

  throw new VetChatImageError("too_large", "รูปภาพนี้ไม่สามารถบีบอัดให้เล็กกว่า 1MB ได้ กรุณาครอปรูปหรือเลือกรูปอื่น");
}

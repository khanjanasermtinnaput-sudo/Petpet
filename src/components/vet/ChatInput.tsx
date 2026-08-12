"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { NeuIconButton } from "@/components/neu/NeuIconButton";
import { NeuIcon } from "@/components/neu/NeuIcon";
import { compressVetChatImage, type ImageCompressionMetadata } from "@/lib/image-compression";

export type ChatInputImage = {
  file: File;
  previewUrl: string;
  metadata: ImageCompressionMetadata;
};

interface ChatInputProps {
  onSend: (message: string, image?: ChatInputImage) => Promise<boolean>;
  disabled?: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "เตรียมรูปภาพไม่สำเร็จ กรุณาลองใหม่";
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<ChatInputImage | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [showCompressing, setShowCompressing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function removeImage() {
    selectionVersion.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setSelectedImage(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const version = ++selectionVersion.current;
    setImageError(null);
    setCompressing(true);
    const indicator = window.setTimeout(() => setShowCompressing(true), 200);
    try {
      const compressed = await compressVetChatImage(file);
      if (version !== selectionVersion.current) return;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const previewUrl = URL.createObjectURL(compressed.file);
      previewUrlRef.current = previewUrl;
      setSelectedImage({ ...compressed, previewUrl });
    } catch (error) {
      if (version === selectionVersion.current) {
        setSelectedImage(null);
        setImageError(errorMessage(error));
      }
    } finally {
      window.clearTimeout(indicator);
      if (version === selectionVersion.current) {
        setCompressing(false);
        setShowCompressing(false);
      }
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || compressing) return;
    const sent = await onSend(trimmed, selectedImage ?? undefined);
    if (!sent) return;
    setValue("");
    previewUrlRef.current = null;
    setSelectedImage(null);
    setImageError(null);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="neu-raised-sm flex flex-col gap-3 p-3">
      {selectedImage ? (
        <div className="relative w-fit max-w-full">
          <Image
            src={selectedImage.previewUrl}
            alt="ตัวอย่างรูปภาพที่จะส่ง"
            width={160}
            height={120}
            unoptimized
            className="h-24 max-w-full rounded-xl object-cover sm:h-28"
          />
          <NeuIconButton
            type="button"
            aria-label="ลบรูปภาพที่เลือก"
            onClick={removeImage}
            disabled={disabled}
            className="absolute -right-2 -top-2 h-8 w-8 bg-neu-bg text-neu-warning"
          >
            <NeuIcon name="close" className="h-4 w-4" />
          </NeuIconButton>
          <p className="mt-1 text-xs text-neu-ink-muted">
            {(selectedImage.metadata.compressedBytes / 1024).toFixed(0)} KB · {selectedImage.metadata.width}×{selectedImage.metadata.height}
          </p>
        </div>
      ) : null}
      {showCompressing ? <p className="text-sm font-semibold text-neu-accent" aria-live="polite">กำลังบีบอัดรูป...</p> : null}
      {imageError ? <p role="alert" className="text-sm font-semibold text-neu-warning">{imageError}</p> : null}
      <div className="flex items-center gap-2 sm:gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="sr-only"
          aria-label="เลือกรูปภาพสำหรับ VET AI"
          onChange={(event) => void handleFileChange(event)}
          disabled={disabled || compressing}
        />
        <NeuIconButton
          type="button"
          aria-label={selectedImage ? "เปลี่ยนรูปภาพ" : "แนบรูปภาพ"}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || compressing}
          className="h-12 w-12 shrink-0 text-neu-accent"
        >
          <NeuIcon name="attachment" className="h-5 w-5" />
        </NeuIconButton>
        <label htmlFor="vet-chat-input" className="sr-only">พิมพ์ข้อความถึง VET AI</label>
        <input
          id="vet-chat-input"
          className="neu-inset neu-focusable min-w-0 flex-1 border-none px-4 py-3 text-neu-ink outline-none placeholder:text-neu-ink-muted/60"
          placeholder={selectedImage ? "ถามเกี่ยวกับรูปนี้..." : "พิมพ์คำถามของคุณ..."}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
        <NeuIconButton
          type="submit"
          aria-label="ส่งข้อความ"
          disabled={disabled || compressing || !value.trim()}
          className="h-12 w-12 shrink-0 text-neu-accent"
        >
          <NeuIcon name="send" className="h-5 w-5" />
        </NeuIconButton>
      </div>
    </form>
  );
}

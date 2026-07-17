import { createHash } from "node:crypto";
import sharp from "sharp";
import { AiOperationError } from "./ai-operation";

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

export const MEDIA_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
] as const;

export type MediaMimeType = typeof MEDIA_MIME_TYPES[number];
export type MediaKind = "image" | "pdf" | "audio" | "video";

export type ValidatedMedia = {
  buffer: Buffer;
  mimeType: MediaMimeType;
  kind: MediaKind;
  sizeBytes: number;
  checksum: string;
};

function mediaError(
  code: "MEDIA_INVALID" | "MEDIA_UNSUPPORTED" | "MEDIA_TOO_LARGE",
  operation: string,
  cause?: unknown,
): AiOperationError {
  return new AiOperationError(code, { operation, cause }).report();
}

export function isSupportedMediaMimeType(value: string): value is MediaMimeType {
  return (MEDIA_MIME_TYPES as readonly string[]).includes(value.toLowerCase());
}

export function getMediaKind(mimeType: MediaMimeType): MediaKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("audio/")) return "audio";
  return "video";
}

function bytesStartWith(buffer: Buffer, values: number[]): boolean {
  return buffer.length >= values.length && values.every((value, index) => buffer[index] === value);
}

function asciiAt(buffer: Buffer, offset: number, expected: string): boolean {
  return buffer.length >= offset + expected.length
    && buffer.subarray(offset, offset + expected.length).toString("ascii") === expected;
}

function inferMimeType(buffer: Buffer, declared: MediaMimeType): MediaMimeType | undefined {
  if (bytesStartWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytesStartWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (asciiAt(buffer, 0, "RIFF") && asciiAt(buffer, 8, "WEBP")) return "image/webp";
  if (asciiAt(buffer, 0, "%PDF-")) return "application/pdf";
  if (asciiAt(buffer, 0, "OggS")) return "audio/ogg";
  if (asciiAt(buffer, 0, "RIFF") && asciiAt(buffer, 8, "WAVE")) return "audio/wav";
  if (bytesStartWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return declared.endsWith("webm") ? declared : undefined;
  if (asciiAt(buffer, 4, "ftyp")) return declared.endsWith("mp4") ? declared : undefined;
  if (asciiAt(buffer, 0, "ID3") || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return undefined;
}

async function verifyPdf(buffer: Buffer, operation: string): Promise<void> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const info = await parser.getInfo();
      if (info.total < 1) throw new Error("PDF has no pages");
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    throw mediaError("MEDIA_INVALID", operation, error);
  }
}

async function verifyImage(buffer: Buffer, mimeType: MediaMimeType, operation: string): Promise<void> {
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" });
    const metadata = await image.metadata();
    const expectedFormat = mimeType === "image/jpeg" ? "jpeg" : mimeType.slice("image/".length);
    if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
      throw new Error("image format or dimensions do not match declared type");
    }
    await image.rotate().toBuffer();
  } catch (error) {
    throw mediaError("MEDIA_INVALID", operation, error);
  }
}

export async function validateMediaBuffer(
  buffer: Buffer,
  declaredMimeType: string,
  operation: string,
): Promise<ValidatedMedia> {
  const mimeType = declaredMimeType.toLowerCase();
  if (!isSupportedMediaMimeType(mimeType)) {
    throw mediaError("MEDIA_UNSUPPORTED", operation);
  }
  if (buffer.length === 0) throw mediaError("MEDIA_INVALID", operation);
  if (buffer.length > MAX_MEDIA_BYTES) throw mediaError("MEDIA_TOO_LARGE", operation);

  const inferred = inferMimeType(buffer, mimeType);
  if (!inferred || inferred !== mimeType) {
    throw mediaError("MEDIA_INVALID", operation);
  }

  const kind = getMediaKind(mimeType);
  if (kind === "image") await verifyImage(buffer, mimeType, operation);
  if (kind === "pdf") await verifyPdf(buffer, operation);

  return {
    buffer,
    mimeType,
    kind,
    sizeBytes: buffer.length,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}

export function mediaTypeFromMime(mimeType: MediaMimeType): "image" | "pdf" | "audio" | "video" {
  return getMediaKind(mimeType);
}

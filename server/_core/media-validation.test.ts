import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({ getInfo: vi.fn(), destroy: vi.fn() }));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getInfo = pdfMocks.getInfo;
    destroy = pdfMocks.destroy;
  },
}));

import {
  MAX_MEDIA_BYTES,
  validateMediaBuffer,
} from "./media-validation";

async function image(format: "png" | "jpeg" | "webp", width = 2, height = 2): Promise<Buffer> {
  const source = sharp({ create: { width, height, channels: 3, background: "#336699" } });
  return format === "png" ? source.png().toBuffer()
    : format === "jpeg" ? source.jpeg().toBuffer()
      : source.webp().toBuffer();
}

const mediaFixtures: Array<{ mimeType: string; buffer: Buffer; kind: string }> = [
  { mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nfixture"), kind: "pdf" },
  { mimeType: "audio/mpeg", buffer: Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0]), kind: "audio" },
  { mimeType: "audio/wav", buffer: Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt "), kind: "audio" },
  { mimeType: "audio/mp4", buffer: Buffer.from("\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00"), kind: "audio" },
  { mimeType: "audio/ogg", buffer: Buffer.from("OggS\x00\x02\x00\x00"), kind: "audio" },
  { mimeType: "audio/webm", buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86]), kind: "audio" },
  { mimeType: "video/mp4", buffer: Buffer.from("\x00\x00\x00\x18ftypisom\x00\x00\x00\x00"), kind: "video" },
  { mimeType: "video/webm", buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86]), kind: "video" },
];

describe("server-owned media validation", () => {
  beforeEach(() => {
    pdfMocks.getInfo.mockResolvedValue({ total: 1 });
    pdfMocks.destroy.mockResolvedValue(undefined);
  });

  it.each(mediaFixtures)("accepts declared $mimeType only after its format check", async ({ mimeType, buffer, kind }) => {
    const media = await validateMediaBuffer(buffer, mimeType, "test.media");

    expect(media.mimeType).toBe(mimeType);
    expect(media.kind).toBe(kind);
    expect(media.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each(["png", "jpeg", "webp"] as const)("decodes a valid %s image", async format => {
    const buffer = await image(format);
    const media = await validateMediaBuffer(buffer, `image/${format === "jpeg" ? "jpeg" : format}`, "test.image");
    expect(media.kind).toBe("image");
  });

  it("rejects zero bytes, a spoofed MIME type, and a corrupt image", async () => {
    await expect(validateMediaBuffer(Buffer.alloc(0), "image/png", "test.invalid"))
      .rejects.toMatchObject({ code: "MEDIA_INVALID" });
    await expect(validateMediaBuffer(await image("jpeg"), "image/png", "test.invalid"))
      .rejects.toMatchObject({ code: "MEDIA_INVALID" });
    await expect(validateMediaBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png", "test.invalid"))
      .rejects.toMatchObject({ code: "MEDIA_INVALID" });
  });

  it("rejects oversized and excessive-pixel images before provider submission", async () => {
    await expect(validateMediaBuffer(Buffer.alloc(MAX_MEDIA_BYTES + 1), "image/png", "test.oversize"))
      .rejects.toMatchObject({ code: "MEDIA_TOO_LARGE" });

    const tooManyPixels = await image("jpeg", 7_000, 6_000);
    await expect(validateMediaBuffer(tooManyPixels, "image/jpeg", "test.pixels"))
      .rejects.toMatchObject({ code: "MEDIA_INVALID" });
  });

  it("rejects a malformed PDF even when its magic bytes look correct", async () => {
    pdfMocks.getInfo.mockRejectedValueOnce(new Error("broken xref"));
    await expect(validateMediaBuffer(Buffer.from("%PDF-1.7\nbroken"), "application/pdf", "test.pdf"))
      .rejects.toMatchObject({ code: "MEDIA_INVALID" });
  });
});

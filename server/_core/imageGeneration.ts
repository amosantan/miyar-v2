import { Buffer } from "node:buffer";
import { z } from "zod";
import { storagePut } from "server/storage";
import { AiOperationError, toAiOperationError } from "./ai-operation";
import { validateMediaBuffer } from "./media-validation";

export type GenerateImageOptions = {
  prompt: string;
};

export type GenerateImageResponse = {
  url: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
};

const IMAGE_RESPONSE_SCHEMA = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({
        inlineData: z.object({ data: z.string().min(1), mimeType: z.string().optional() }).optional(),
      })),
    }).optional(),
  })).default([]),
});
const MAX_RETRIES = 2;

function retryDelay(attempt: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, (2 ** attempt) * 1_000));
}

function imageErrorForStatus(status: number): AiOperationError {
  if (status === 400) return new AiOperationError("PROVIDER_REJECTED_INPUT", { operation: "gemini.image-generation" });
  if (status === 401 || status === 403) return new AiOperationError("PROVIDER_UNAUTHORIZED", { operation: "gemini.image-generation", providerStatus: status });
  if (status === 429) return new AiOperationError("PROVIDER_RATE_LIMITED", { operation: "gemini.image-generation", providerStatus: status, retryable: true });
  return new AiOperationError("PROVIDER_UNAVAILABLE", { operation: "gemini.image-generation", providerStatus: status, retryable: status >= 500 });
}

/** Gemini native image generation with a server-validated output boundary. */
export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiOperationError("PROVIDER_UNAUTHORIZED", { operation: "gemini.image-generation" }).report();
  }

  const model = "gemini-2.5-flash-image";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  let response: Response | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: options.prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"], responseMimeType: "text/plain" },
        }),
      });
    } catch (error) {
      const failure = toAiOperationError(error, "gemini.image-generation");
      if (!failure.retryable || attempt === MAX_RETRIES) throw failure.report();
      await retryDelay(attempt + 1);
      continue;
    }
    if (response.ok) break;
    const failure = imageErrorForStatus(response.status);
    if (!failure.retryable || attempt === MAX_RETRIES) throw failure.report();
    await retryDelay(attempt + 1);
  }
  if (!response?.ok) throw new AiOperationError("PROVIDER_UNAVAILABLE", { operation: "gemini.image-generation", retryable: true }).report();

  let parsed: z.infer<typeof IMAGE_RESPONSE_SCHEMA>;
  try {
    parsed = IMAGE_RESPONSE_SCHEMA.parse(await response.json());
  } catch (error) {
    throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: "gemini.image-generation", cause: error }).report();
  }
  const inlineData = parsed.candidates
    .flatMap(candidate => candidate.content?.parts || [])
    .find(part => part.inlineData)?.inlineData;
  if (!inlineData) throw new AiOperationError(parsed.candidates.length === 0 ? "CONTENT_BLOCKED" : "PROVIDER_INVALID_RESPONSE", { operation: "gemini.image-generation" }).report();

  const raw = Buffer.from(inlineData.data, "base64");
  const media = await validateMediaBuffer(raw, inlineData.mimeType || "image/png", "gemini.image-generation-output");
  const extension = media.mimeType === "image/jpeg" ? "jpg" : media.mimeType === "image/webp" ? "webp" : "png";
  const stored = await storagePut(`generated/${Date.now()}-${media.checksum.slice(0, 12)}.${extension}`, media.buffer, media.mimeType);
  return {
    url: stored.url,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    checksum: media.checksum,
    storageKey: stored.key,
  };
}

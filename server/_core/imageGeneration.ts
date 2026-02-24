/**
 * Image generation helper using Gemini native image generation
 *
 * Uses gemini-2.0-flash-exp with responseModalities: ["IMAGE", "TEXT"]
 * for native image generation via the Gemini API.
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 */
import { storagePut } from "server/storage";
import { Buffer } from "buffer";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Use Gemini native image generation (generateContent with IMAGE modality)
  const model = "gemini-2.0-flash-exp";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: options.prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        responseMimeType: "text/plain",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = await response.json();

  // Extract inline image data from the response
  const candidates = result.candidates || [];
  let base64Data: string | undefined;
  let mimeType = "image/png";

  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        base64Data = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }
    if (base64Data) break;
  }

  if (!base64Data) {
    throw new Error("Gemini Image API returned no image data in the response");
  }

  const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.${ext}`,
    buffer,
    mimeType
  );
  return {
    url,
  };
}

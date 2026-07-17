import {
  AiOperationError,
  toAiOperationError,
  type AiOperationCode,
} from "./ai-operation";
import type { ValidatedMedia } from "./media-validation";
import { z } from "zod";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};
/** Server-only, validated media. New media callers must use this form. */
export type MediaContent = { type: "media"; media: ValidatedMedia };
export type MessageContent = string | TextContent | ImageContent | FileContent | MediaContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
};
export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = { type: "function"; function: { name: string } };
export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: Role; content: string | Array<TextContent | ImageContent | FileContent>; tool_calls?: ToolCall[] };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { fileUri: string; mimeType: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiTool = { functionDeclarations: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }> };
type GeminiFile = { name: string; uri: string; mimeType: string; state?: "PROCESSING" | "ACTIVE" | "FAILED" };

const GEMINI_OPERATION = "gemini.generate-content";
const INLINE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 60_000;
const FILE_PROCESS_TIMEOUT_MS = 120_000;
const FILE_PROCESS_POLL_MS = 2_000;
const MAX_RETRIES = 2;

const GEMINI_GENERATE_RESPONSE_SCHEMA = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({
        text: z.string().optional(),
        functionCall: z.object({
          name: z.string(),
          args: z.record(z.string(), z.unknown()).optional(),
        }).optional(),
      }).passthrough()),
    }).optional(),
    finishReason: z.string().optional(),
  })).optional().default([]),
  promptFeedback: z.unknown().optional(),
  usageMetadata: z.object({
    promptTokenCount: z.number().optional(),
    candidatesTokenCount: z.number().optional(),
    totalTokenCount: z.number().optional(),
  }).optional(),
});

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] => Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): Exclude<MessageContent, string> => {
  if (typeof part === "string") return { type: "text", text: part };
  return part;
};

const mapRoleToGemini = (role: Role): "user" | "model" => role === "assistant" ? "model" : "user";

function geminiApiUrl(path: string): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AiOperationError("PROVIDER_UNAUTHORIZED", { operation: GEMINI_OPERATION }).report();
  }
  return `https://generativelanguage.googleapis.com/v1beta/${path}?key=${encodeURIComponent(key)}`;
}

function classifyProviderError(status: number, operation: string): AiOperationError {
  const mappings: Record<number, { code: AiOperationCode; retryable?: boolean }> = {
    400: { code: "PROVIDER_REJECTED_INPUT" },
    401: { code: "PROVIDER_UNAUTHORIZED" },
    403: { code: "PROVIDER_UNAUTHORIZED" },
    408: { code: "PROVIDER_TIMEOUT", retryable: true },
    429: { code: "PROVIDER_RATE_LIMITED", retryable: true },
    500: { code: "PROVIDER_UNAVAILABLE", retryable: true },
    502: { code: "PROVIDER_UNAVAILABLE", retryable: true },
    503: { code: "PROVIDER_UNAVAILABLE", retryable: true },
    504: { code: "PROVIDER_TIMEOUT", retryable: true },
  };
  const mapped = mappings[status] ?? { code: "PROVIDER_UNAVAILABLE" as const, retryable: status >= 500 };
  return new AiOperationError(mapped.code, { operation, retryable: mapped.retryable, providerStatus: status });
}

async function providerFetch(url: string, init: RequestInit, operation: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (error) {
    throw toAiOperationError(error, operation).report();
  }
}

async function parseGeminiFile(response: Response, operation: string): Promise<GeminiFile> {
  if (!response.ok) throw classifyProviderError(response.status, operation).report();
  let body: { file?: GeminiFile };
  try {
    body = await response.json() as { file?: GeminiFile };
  } catch (error) {
    throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation, cause: error }).report();
  }
  if (!body.file?.name || !body.file.uri || !body.file.mimeType) {
    throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation }).report();
  }
  return body.file;
}

async function uploadGeminiFile(media: ValidatedMedia, cleanup: string[]): Promise<GeminiFile> {
  const operation = "gemini.files.upload";
  const start = await providerFetch(geminiApiUrl("upload/v1beta/files"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(media.sizeBytes),
      "X-Goog-Upload-Header-Content-Type": media.mimeType,
    },
    body: JSON.stringify({ file: { displayName: `miyar-${media.checksum.slice(0, 12)}` } }),
  }, operation);
  if (!start.ok) throw classifyProviderError(start.status, operation).report();
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation }).report();

  const finalized = await providerFetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(media.sizeBytes),
      "Content-Type": media.mimeType,
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(media.buffer),
  }, operation);
  let file = await parseGeminiFile(finalized, operation);
  // Register cleanup before polling. If provider processing later fails or
  // times out, invokeLLM's finally block still knows which temporary file to
  // delete.
  cleanup.push(file.name);

  const deadline = Date.now() + FILE_PROCESS_TIMEOUT_MS;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, FILE_PROCESS_POLL_MS));
    const state = await providerFetch(geminiApiUrl(file.name), { method: "GET" }, "gemini.files.get");
    file = await parseGeminiFile(state, "gemini.files.get");
  }
  if (file.state === "FAILED") {
    throw new AiOperationError("PROVIDER_REJECTED_INPUT", { operation }).report();
  }
  if (file.state === "PROCESSING") {
    throw new AiOperationError("PROVIDER_TIMEOUT", { operation, retryable: true }).report();
  }
  return file;
}

async function deleteGeminiFile(fileName: string): Promise<void> {
  try {
    const response = await providerFetch(geminiApiUrl(fileName), { method: "DELETE" }, "gemini.files.delete");
    if (!response.ok) loggerSafeDeleteFailure(response.status);
  } catch {
    // Gemini deletes files after 48 hours. Deletion failure is telemetry-only.
  }
}

function loggerSafeDeleteFailure(status: number) {
  // Avoid surfacing provider response bodies or file URLs in application logs.
  console.warn(`[Gemini Files] cleanup failed with HTTP ${status}`);
}

async function mediaToGeminiPart(media: ValidatedMedia, cleanup: string[]): Promise<GeminiPart> {
  if (media.kind === "image" && media.sizeBytes <= INLINE_IMAGE_MAX_BYTES) {
    return { inlineData: { mimeType: media.mimeType, data: media.buffer.toString("base64") } };
  }
  const file = await uploadGeminiFile(media, cleanup);
  return { fileData: { fileUri: file.uri, mimeType: file.mimeType } };
}

async function normalizeContentToGeminiParts(
  content: MessageContent | MessageContent[],
  cleanup: string[],
): Promise<GeminiPart[]> {
  const parts = ensureArray(content).map(normalizeContentPart);
  return Promise.all(parts.map(async part => {
    if (part.type === "text") return { text: part.text };
    if (part.type === "media") return mediaToGeminiPart(part.media, cleanup);
    // URL-shaped media was the source of the original incident. Only a router
    // that has read and validated storage bytes may create MediaContent.
    if (part.type === "image_url" || part.type === "file_url") {
      throw new AiOperationError("MEDIA_UNAVAILABLE", { operation: GEMINI_OPERATION }).report();
    }
    return { text: "" };
  }));
}

async function convertMessagesToGemini(messages: Message[], cleanup: string[]): Promise<{
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
}> {
  let systemInstruction: { parts: Array<{ text: string }> } | undefined;
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      const parts = await normalizeContentToGeminiParts(message.content, cleanup);
      const textParts = parts.filter((part): part is { text: string } => "text" in part);
      if (textParts.length !== parts.length) {
        throw new AiOperationError("MEDIA_INVALID", { operation: GEMINI_OPERATION }).report();
      }
      if (!systemInstruction) systemInstruction = { parts: [] };
      systemInstruction.parts.push(...textParts);
      continue;
    }

    if (message.role === "tool" || message.role === "function") {
      const responseText = ensureArray(message.content)
        .map(part => typeof part === "string" ? part : JSON.stringify(part))
        .join("\n");
      let response: Record<string, unknown>;
      try { response = JSON.parse(responseText) as Record<string, unknown>; }
      catch { response = { result: responseText }; }
      contents.push({ role: "user", parts: [{ functionResponse: { name: message.name || "unknown_tool", response } }] });
      continue;
    }

    const parts = await normalizeContentToGeminiParts(message.content, cleanup);
    contents.push({ role: mapRoleToGemini(message.role), parts });
  }

  return { systemInstruction, contents };
}

function resolveApiUrl(): string {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return geminiApiUrl(`models/${encodeURIComponent(model)}:generateContent`);
}

function retryDelay(attempt: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, (2 ** attempt) * 1_000));
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const cleanup: string[] = [];
  try {
    const { systemInstruction, contents } = await convertMessagesToGemini(params.messages, cleanup);
    const payload: Record<string, unknown> = { contents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    if (params.tools?.length) {
      payload.tools = [{ functionDeclarations: params.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      })) } satisfies GeminiTool];
    }

    const schema = params.outputSchema || params.output_schema;
    const responseFormat = params.responseFormat || params.response_format;
    if (schema) {
      payload.generationConfig = {
        responseMimeType: "application/json",
        responseSchema: schema.schema,
        maxOutputTokens: params.maxTokens || params.max_tokens,
      };
    } else if (responseFormat?.type === "json_object") {
      payload.generationConfig = { responseMimeType: "application/json", maxOutputTokens: params.maxTokens || params.max_tokens };
    }

    let response: Response | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      response = await providerFetch(resolveApiUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }, GEMINI_OPERATION);
      if (response.ok) break;
      const providerError = classifyProviderError(response.status, GEMINI_OPERATION);
      if (!providerError.retryable || attempt === MAX_RETRIES) throw providerError.report();
      await retryDelay(attempt + 1);
    }
    if (!response?.ok) throw new AiOperationError("PROVIDER_UNAVAILABLE", { operation: GEMINI_OPERATION, retryable: true }).report();

    let data: z.infer<typeof GEMINI_GENERATE_RESPONSE_SCHEMA>;
    try { data = GEMINI_GENERATE_RESPONSE_SCHEMA.parse(await response.json()); }
    catch (error) { throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: GEMINI_OPERATION, cause: error }).report(); }
    const candidate = data.candidates?.[0];
    if (!candidate) {
      const code: AiOperationCode = data.promptFeedback ? "CONTENT_BLOCKED" : "PROVIDER_INVALID_RESPONSE";
      throw new AiOperationError(code, { operation: GEMINI_OPERATION }).report();
    }

    const parts = candidate.content?.parts ?? [];
    const text = parts.flatMap(part => typeof part.text === "string" ? [part.text] : []).join("");
    const functionCalls = parts.flatMap(part => part.functionCall ? [part.functionCall] : []);
    if (!text && functionCalls.length === 0) {
      throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: GEMINI_OPERATION }).report();
    }
    const toolCalls = functionCalls.length ? functionCalls.map((functionCall, index: number) => ({
      id: `call_${Date.now()}_${index}`,
      type: "function" as const,
      function: { name: functionCall.name, arguments: JSON.stringify(functionCall.args || {}) },
    })) : undefined;

    return {
      id: `gemini-${Date.now()}`,
      created: Math.floor(Date.now() / 1_000),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      choices: [{
        index: 0,
        message: { role: "assistant", content: text, tool_calls: toolCalls },
        finish_reason: candidate.finishReason === "STOP" ? "stop" : functionCalls.length ? "tool_calls" : "length",
      }],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  } finally {
    await Promise.all(cleanup.map(deleteGeminiFile));
  }
}

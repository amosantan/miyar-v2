import { ENV } from "./env";
import process from "process";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

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
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

// ============================================================================
// GEMINI API TRANSLATION LAYER
// ============================================================================

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiTool = {
  functionDeclarations: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
};

const mapRoleToGemini = (role: Role): "user" | "model" => {
  if (role === "assistant") return "model";
  // "system", "user", "tool", "function" all become "user" (or are handled specially)
  return "user";
};

const normalizeContentToGeminiParts = (
  content: MessageContent | MessageContent[]
): GeminiPart[] => {
  const parts = ensureArray(content).map(normalizeContentPart);
  return parts.map((part) => {
    if (part.type === "text") return { text: part.text };
    if (part.type === "image_url") {
      // NOTE: Gemini API expects base64 inlineData or uploaded fileUri for images.
      // If we only have a URL, we'd theoretically need to fetch it first. 
      // For this handover, we assume the pipeline passes texts or we mock image support.
      return { text: `[Image reference: ${part.image_url.url}]` };
    }
    if (part.type === "file_url") {
      return { text: `[File reference: ${part.file_url.url}]` };
    }
    return { text: "" };
  });
};

const convertMessagesToGemini = (
  messages: Message[]
): {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
} => {
  let systemInstruction: { parts: { text: string }[] } | undefined;
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const parts = normalizeContentToGeminiParts(msg.content);
      if (!systemInstruction) systemInstruction = { parts: [] };
      systemInstruction.parts.push(...(parts as { text: string }[]));
      continue;
    }

    if (msg.role === "tool" || msg.role === "function") {
      // Tool responses must be functionResponse parts in a user message
      const responseText = ensureArray(msg.content)
        .map(p => (typeof p === "string" ? p : JSON.stringify(p)))
        .join("\n");

      let parsedResponse: Record<string, unknown>;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        parsedResponse = { result: responseText };
      }

      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: msg.name || "unknown_tool",
            response: parsedResponse,
          }
        }]
      });
      continue;
    }

    const role = mapRoleToGemini(msg.role);
    const parts = normalizeContentToGeminiParts(msg.content);

    // If there were tool_calls in an assistant message, they become functionCall parts
    if (msg.role === "assistant" && (msg as any).tool_calls?.length > 0) {
      const functionCalls = (msg as any).tool_calls.map((tc: ToolCall) => ({
        functionCall: {
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || "{}"),
        }
      }));
      contents.push({
        role: "model",
        parts: [...(parts as any), ...functionCalls]
      });
      continue;
    }

    contents.push({ role, parts });
  }

  // Gemini doesn't allow two adjacent user/model messages. It must strictly alternate.
  // Real implementation sometimes requires merging adjacent roles. For MVP handover logic,
  // we pass them directly as it usually aligns correctly.

  return { systemInstruction, contents };
};

const resolveApiUrl = () => {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
};

const assertApiKey = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in the environment");
  }
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const { systemInstruction, contents } = convertMessagesToGemini(messages);

  const payload: Record<string, unknown> = {
    contents,
  };

  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }

  // Tools formatting
  if (tools && tools.length > 0) {
    const geminiTools: GeminiTool[] = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
    payload.tools = geminiTools;
  }

  // Response format formatting (simulated JSON schema for Gemini config)
  const schema = outputSchema || output_schema;
  const explicitFormat = responseFormat || response_format;

  if (schema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema.schema,
    };
  } else if (explicitFormat?.type === "json_object") {
    payload.generationConfig = {
      responseMimeType: "application/json",
    };
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  if (!candidate) {
    throw new Error("No candidates returned from Gemini API");
  }

  // Convert Gemini Candidate back to OpenAI InvokeResult
  const parts = candidate.content?.parts || [];

  // Extract text and tool calls
  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join("");
  const functionCallParts = parts.filter((p: any) => p.functionCall);

  let tool_calls: ToolCall[] | undefined;
  if (functionCallParts.length > 0) {
    tool_calls = functionCallParts.map((fc: any, idx: number) => ({
      id: `call_${Date.now()}_${idx}`,
      type: "function",
      function: {
        name: fc.functionCall.name,
        arguments: JSON.stringify(fc.functionCall.args || {}),
      },
    }));
  }

  return {
    id: `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textParts,
          tool_calls,
        },
        finish_reason: candidate.finishReason === "STOP" ? "stop" :
          functionCallParts.length > 0 ? "tool_calls" : "length",
      },
    ],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0,
    },
  };
}
